"use client";

import { useState } from "react";
import TruthEngine from "@/lib/genlayer/TruthEngine";
import { connectWallet } from "@/lib/genlayer/client";

type EvidenceResult = {
  title: string;
  url: string;
  snippet: string;
  domain?: string;
  score?: number;
};

type Receipt = {
  caseId: number | null;
  question: string;
  verdict: string;
  explanation: string;
  evidenceSummary: string;
  status: string;
  transactionHash: string;
};

const examples = [
  "Has Apple officially launched the iPhone 18?",
  "Did the Nigerian contestant win Miss World?",
  "Can rice and plantain be eaten together as part of a healthy diet?",
];

const progressSteps = [
  "Discovering evidence",
  "Creating Truth Case",
  "Validators examining evidence",
  "Reaching consensus",
  "Truth Receipt ready",
];

const contractAddress =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

const rpcUrl =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ||
  "https://studio-dev.genlayer.com/api";

export default function Home() {
  const [question, setQuestion] = useState("");

  const [walletAddress, setWalletAddress] = useState("");
  const [connectingWallet, setConnectingWallet] =
    useState(false);
  const [walletMenuOpen, setWalletMenuOpen] =
    useState(false);

  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [stage, setStage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [evidence, setEvidence] = useState<
    EvidenceResult[]
  >([]);

  const [receipt, setReceipt] = useState<Receipt>({
    caseId: null,
    question: "",
    verdict: "",
    explanation: "",
    evidenceSummary: "",
    status: "",
    transactionHash: "",
  });

  async function handleConnectWallet() {
    try {
      setConnectingWallet(true);

      const address = await connectWallet();

      setWalletAddress(address);
      setWalletMenuOpen(false);
    } catch (error) {
      console.error("Wallet connection error:", error);

      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert("Unable to connect wallet.");
      }
    } finally {
      setConnectingWallet(false);
    }
  }

  function handleDisconnectWallet() {
    setWalletAddress("");
    setWalletMenuOpen(false);
  }

  function shortAddress(address: string) {
    if (!address) {
      return "";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  async function discoverEvidence(
    userQuestion: string
  ): Promise<EvidenceResult[]> {
    const response = await fetch(
      "/api/search-evidence",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userQuestion,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Evidence discovery failed."
      );
    }

    if (
      !Array.isArray(data?.results) ||
      data.results.length === 0
    ) {
      throw new Error(
        "Truth Engine could not find usable evidence for this question."
      );
    }

    return data.results;
  }

  async function findCreatedCaseId(
    truthEngine: TruthEngine,
    beforeCount: number,
    afterCount: number,
    userQuestion: string
  ) {
    /*
      Usually our new case will simply be
      afterCount.

      We scan the newly-created range as
      a small safeguard in case another case
      was created at roughly the same time.
    */
    for (
      let caseId = afterCount;
      caseId > beforeCount;
      caseId--
    ) {
      try {
        const caseData =
          await truthEngine.getCase(caseId);

        if (
          caseData.includes(
            `Question: ${userQuestion}`
          )
        ) {
          return caseId;
        }
      } catch {
        // Keep checking the next candidate.
      }
    }

    return afterCount;
  }

  async function handleAskTruthEngine() {
    const cleanQuestion = question.trim();

    if (!cleanQuestion) {
      alert("Please enter a question.");
      return;
    }

    if (!walletAddress) {
      alert(
        "Connect your wallet before asking Truth Engine."
      );
      return;
    }

    if (!contractAddress) {
      setErrorMessage(
        "Truth Engine contract address is not configured."
      );
      return;
    }

    try {
      setProcessing(true);
      setProcessingStep(1);
      setErrorMessage("");
      setEvidence([]);

      setReceipt({
        caseId: null,
        question: cleanQuestion,
        verdict: "",
        explanation: "",
        evidenceSummary: "",
        status: "PROCESSING",
        transactionHash: "",
      });

      /*
        STEP 1:
        Discover candidate evidence.
      */
      setStage(
        "Discovering relevant evidence from the web..."
      );

      const discovered =
        await discoverEvidence(cleanQuestion);

      setEvidence(discovered);
      setProcessingStep(2);

      const source1 =
        discovered[0]?.url || "";

      const source2 =
        discovered[1]?.url || "";

      const source3 =
        discovered[2]?.url || "";

      /*
        STEP 2:
        Create the on-chain Truth Case.
      */
      setStage(
        "Creating your on-chain Truth Case. Review the wallet transaction details before approving."
      );

      const truthEngine =
        new TruthEngine(
          contractAddress,
          walletAddress,
          rpcUrl
        );

      const beforeCount =
        await truthEngine.getCaseCount();

      const createTxHash =
        await truthEngine.createCase(
          cleanQuestion,
          source1,
          source2,
          source3
        );

      setStage(
        "Truth Case submitted. Waiting for GenLayer to accept the transaction..."
      );

      await truthEngine.waitForAcceptedTransaction(
        createTxHash
      );

      const afterCount =
        await truthEngine.getCaseCount();

      if (afterCount <= beforeCount) {
        throw new Error(
          "The transaction was accepted, but the new Truth Case could not be located."
        );
      }

      const caseId =
        await findCreatedCaseId(
          truthEngine,
          beforeCount,
          afterCount,
          cleanQuestion
        );

      setReceipt((current) => ({
        ...current,
        caseId,
        transactionHash: createTxHash,
      }));

      setProcessingStep(3);

      /*
        STEP 3:
        Ask GenLayer validators to independently
        investigate the evidence and reach consensus.
      */
      setStage(
        `Case #${caseId} is ready. GenLayer validators are preparing to examine the evidence independently.`
      );

      const resolveTxHash =
        await truthEngine.resolveCase(caseId);

      setReceipt((current) => ({
        ...current,
        transactionHash:
          resolveTxHash,
      }));

      setProcessingStep(4);

      /*
        We deliberately do NOT depend on the
        SDK transaction waiter here.

        Intelligent Consensus can take longer
        than an ordinary write transaction.

        Instead we poll the actual contract
        until the case reaches RESOLVED.
      */
      setStage(
        "Reaching consensus. Validators are independently inspecting the evidence, so this step can take a little while."
      );

      await truthEngine.waitForCaseResolved(
        caseId
      );

      /*
        STEP 4:
        Read the finalized result directly
        from the contract.
      */
      setProcessingStep(5);
      setStage(
        "Consensus reached. Building your finalized Truth Receipt..."
      );

      const [
        verdict,
        explanation,
        evidenceSummary,
        status,
      ] = await Promise.all([
        truthEngine.getVerdict(caseId),
        truthEngine.getExplanation(caseId),
        truthEngine.getEvidenceSummary(
          caseId
        ),
        truthEngine.getStatus(caseId),
      ]);

      setReceipt({
        caseId,
        question: cleanQuestion,
        verdict,
        explanation,
        evidenceSummary,
        status,
        transactionHash:
          resolveTxHash,
      });

      setStage("");
    } catch (error) {
      console.error(
        "Truth Engine request error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      setErrorMessage(message);

      /*
        Important:
        If consensus simply takes longer than
        our browser waiting window, we do not
        pretend the on-chain transaction failed.
      */
      if (
        message
          .toLowerCase()
          .includes(
            "consensus is still processing"
          )
      ) {
        setStage(
          "Consensus is still processing on-chain. The case may complete shortly."
        );
      } else {
        setStage("");
        setProcessingStep(0);
      }
    } finally {
      setProcessing(false);
    }
  }

  function verdictColor(verdict: string) {
    switch (
      verdict.trim().toUpperCase()
    ) {
      case "TRUE":
        return "text-emerald-300";

      case "FALSE":
        return "text-red-300";

      case "CONTEXTUAL":
        return "text-amber-300";

      case "UNRESOLVED":
        return "text-violet-300";

      default:
        return "text-cyan-300";
    }
  }

  const hasReceipt =
    receipt.caseId !== null &&
    Boolean(receipt.verdict);

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 md:px-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-400">
              GenLayer
            </p>

            <h1 className="mt-1 text-xl font-bold">
              Truth Engine
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 sm:block">
              Intelligent Consensus
            </div>

            <div className="relative">
              {!walletAddress ? (
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  disabled={connectingWallet}
                  className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20 disabled:opacity-60"
                >
                  {connectingWallet
                    ? "Connecting..."
                    : "Connect Wallet"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setWalletMenuOpen(
                        (current) => !current
                      )
                    }
                    className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
                  >
                    {shortAddress(
                      walletAddress
                    )}
                  </button>

                  {walletMenuOpen && (
                    <div className="absolute right-0 z-50 mt-3 w-64 rounded-2xl border border-white/10 bg-[#0b1726] p-3 shadow-2xl">
                      <div className="rounded-xl bg-white/[0.04] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/30">
                          Connected Wallet
                        </p>

                        <p className="mt-2 break-all text-sm text-white/70">
                          {walletAddress}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={
                          handleDisconnectWallet
                        }
                        className="mt-3 w-full rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-400/20"
                      >
                        Disconnect Wallet
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-1 items-center py-20">
          <div className="grid w-full gap-14 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-6 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300">
                Evidence-backed answers,
                finalized on-chain
              </div>

              <h2 className="max-w-4xl text-5xl font-bold leading-tight md:text-7xl">
                Don&apos;t trust one AI.

                <span className="block text-cyan-400">
                  Ask the consensus.
                </span>
              </h2>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/60">
                Ask a question. Truth Engine
                discovers evidence and uses
                GenLayer Intelligent Consensus
                to produce a verifiable answer.
              </p>

              <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-cyan-950/20">
                <textarea
                  value={question}
                  onChange={(event) =>
                    setQuestion(
                      event.target.value
                    )
                  }
                  disabled={processing}
                  placeholder="Ask anything that can be investigated..."
                  className="min-h-36 w-full resize-none bg-transparent px-4 py-4 text-lg text-white outline-none placeholder:text-white/30 disabled:opacity-60"
                />

                <div className="flex flex-col gap-3 border-t border-white/10 px-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-white/35">
                    Evidence is discovered
                    automatically. GenLayer
                    reaches the verdict.
                  </p>

                  <button
                    type="button"
                    onClick={
                      handleAskTruthEngine
                    }
                    disabled={processing}
                    className="rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-[#06101b] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processing
                      ? "Investigating..."
                      : "Ask Truth Engine"}
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm text-white/35">
                  Try an example
                </p>

                <div className="flex flex-wrap gap-3">
                  {examples.map(
                    (example) => (
                      <button
                        key={example}
                        type="button"
                        disabled={
                          processing
                        }
                        onClick={() =>
                          setQuestion(
                            example
                          )
                        }
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65 transition hover:border-cyan-400/30 hover:text-white disabled:opacity-40"
                      >
                        {example}
                      </button>
                    )
                  )}
                </div>
              </div>

              {stage && (
                <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-5">
                  <div className="flex items-start gap-4">
                    {processing && (
                      <div className="mt-1 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/70">
                        Truth Engine is working
                      </p>

                      <p className="mt-2 text-sm leading-6 text-white/75">
                        {stage}
                      </p>

                      <div className="mt-5 grid gap-2 sm:grid-cols-5">
                        {progressSteps.map((label, index) => {
                          const stepNumber = index + 1;
                          const isComplete =
                            processingStep > stepNumber;
                          const isCurrent =
                            processingStep === stepNumber;

                          return (
                            <div
                              key={label}
                              className={`rounded-xl border px-3 py-3 ${
                                isCurrent
                                  ? "border-cyan-300/40 bg-cyan-300/10"
                                  : isComplete
                                    ? "border-emerald-300/20 bg-emerald-300/[0.06]"
                                    : "border-white/10 bg-black/10"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                    isCurrent
                                      ? "bg-cyan-300 text-[#06101b]"
                                      : isComplete
                                        ? "bg-emerald-300/15 text-emerald-300"
                                        : "bg-white/5 text-white/30"
                                  }`}
                                >
                                  {isComplete ? "✓" : stepNumber}
                                </span>

                                <span
                                  className={`text-xs leading-5 ${
                                    isCurrent
                                      ? "font-semibold text-cyan-100"
                                      : isComplete
                                        ? "text-white/55"
                                        : "text-white/30"
                                  }`}
                                >
                                  {label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {processingStep >= 3 && processingStep <= 4 && (
                        <p className="mt-4 text-xs leading-5 text-white/40">
                          Intelligent Consensus can take longer than a normal AI response because GenLayer validators independently examine the evidence before the case is finalized.
                        </p>
                      )}

                      {processingStep === 2 && (
                        <p className="mt-4 text-xs leading-5 text-white/40">
                          The current MVP uses wallet approvals for on-chain actions. Always review the transaction details shown by your wallet before approving.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300/70">
                    Notice
                  </p>

                  <p className="mt-2 text-sm leading-6 text-red-100/70">
                    {errorMessage}
                  </p>
                </div>
              )}

              {evidence.length > 0 && (
                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/30">
                    Evidence discovered
                  </p>

                  <div className="mt-4 space-y-3">
                    {evidence.map(
                      (item, index) => (
                        <a
                          key={`${item.url}-${index}`}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-cyan-400/30"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-white/80">
                                {item.title ||
                                  `Source ${index + 1}`}
                              </p>

                              <p className="mt-1 break-all text-xs text-cyan-300/60">
                                {item.domain ||
                                  item.url}
                              </p>
                            </div>

                            <span className="text-xs text-white/25">
                              0{index + 1}
                            </span>
                          </div>
                        </a>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center">
              <div className="w-full rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.025] p-7">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
                    Truth Receipt
                  </p>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      hasReceipt
                        ? "bg-emerald-400/10 text-emerald-300"
                        : processing
                          ? "bg-cyan-400/10 text-cyan-300"
                          : "bg-white/5 text-white/35"
                    }`}
                  >
                    {hasReceipt
                      ? "RESOLVED"
                      : processing
                        ? "PROCESSING"
                        : "READY"}
                  </span>
                </div>

                {!receipt.question ? (
                  <div className="py-20 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10">
                      <span className="text-2xl">
                        ?
                      </span>
                    </div>

                    <h3 className="mt-6 text-xl font-semibold">
                      Your Truth Receipt
                    </h3>

                    <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/40">
                      Ask a question to generate
                      an evidence-backed,
                      on-chain consensus result.
                    </p>
                  </div>
                ) : (
                  <>
                    {receipt.caseId && (
                      <div className="mt-6">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                          Case
                        </p>

                        <p className="mt-2 font-semibold text-cyan-300">
                          #{receipt.caseId}
                        </p>
                      </div>
                    )}

                    <div className="mt-7">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                        Question
                      </p>

                      <p className="mt-2 text-xl font-semibold leading-8">
                        {receipt.question}
                      </p>
                    </div>

                    <div className="mt-8">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                        Verdict
                      </p>

                      {receipt.verdict ? (
                        <p
                          className={`mt-2 text-4xl font-bold ${verdictColor(
                            receipt.verdict
                          )}`}
                        >
                          {receipt.verdict}
                        </p>
                      ) : (
                        <p className="mt-2 text-lg font-semibold text-cyan-300">
                          Investigating...
                        </p>
                      )}
                    </div>

                    <div className="mt-8 border-t border-white/10 pt-6">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                        Why
                      </p>

                      <p className="mt-3 leading-7 text-white/60">
                        {receipt.explanation ||
                          "GenLayer validators are independently evaluating the available evidence."}
                      </p>
                    </div>

                    {receipt.evidenceSummary && (
                      <div className="mt-8 border-t border-white/10 pt-6">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/30">
                          Evidence Summary
                        </p>

                        <p className="mt-3 leading-7 text-white/55">
                          {
                            receipt.evidenceSummary
                          }
                        </p>
                      </div>
                    )}

                    <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-black/20 p-4">
                        <p className="text-xs text-white/30">
                          Consensus
                        </p>

                        <p className="mt-1 font-semibold">
                          GenLayer
                        </p>
                      </div>

                      <div className="rounded-2xl bg-black/20 p-4">
                        <p className="text-xs text-white/30">
                          Status
                        </p>

                        <p className="mt-1 font-semibold">
                          {receipt.status ||
                            "Processing"}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-white/10 pt-6 text-sm text-white/30">
          Truth Engine · Verifiable answers
          through GenLayer Intelligent Consensus
        </footer>
      </section>
    </main>
  );
}
