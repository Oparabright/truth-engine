import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

class TruthEngine {
  private contractAddress: `0x${string}`;
  private readClient: any;
  private writeClient: any | null = null;
  private account?: `0x${string}`;

  constructor(
    contractAddress: string,
    address?: string | null,
    studioUrl?: string
  ) {
    this.contractAddress =
      contractAddress as `0x${string}`;

    const readConfig: any = {
      chain: studioDevnet,
    };

    if (studioUrl) {
      readConfig.endpoint = studioUrl;
    }

    this.readClient = createClient(readConfig);

    if (
      typeof window !== "undefined" &&
      window.ethereum &&
      address
    ) {
      this.account = address as `0x${string}`;

      const writeConfig: any = {
        chain: studioDevnet,
        account: this.account,
        provider: window.ethereum,
      };

      if (studioUrl) {
        writeConfig.endpoint = studioUrl;
      }

      this.writeClient = createClient(writeConfig);
    }
  }

  async getCaseCount(): Promise<number> {
    const result =
      await this.readClient.readContract({
        address: this.contractAddress,
        functionName: "get_case_count",
        args: [],
      });

    return Number(result);
  }

  async getCase(
    caseId: number
  ): Promise<string> {
    const result =
      await this.readClient.readContract({
        address: this.contractAddress,
        functionName: "get_case",
        args: [caseId],
      });

    return String(result);
  }

  async getStatus(
    caseId: number
  ): Promise<string> {
    const result =
      await this.readClient.readContract({
        address: this.contractAddress,
        functionName: "get_status",
        args: [caseId],
      });

    return String(result);
  }

  async getVerdict(
    caseId: number
  ): Promise<string> {
    const result =
      await this.readClient.readContract({
        address: this.contractAddress,
        functionName: "get_verdict",
        args: [caseId],
      });

    return String(result);
  }

  async getExplanation(
    caseId: number
  ): Promise<string> {
    const result =
      await this.readClient.readContract({
        address: this.contractAddress,
        functionName: "get_explanation",
        args: [caseId],
      });

    return String(result);
  }

  async getEvidenceSummary(
    caseId: number
  ): Promise<string> {
    const result =
      await this.readClient.readContract({
        address: this.contractAddress,
        functionName: "get_evidence_summary",
        args: [caseId],
      });

    return String(result);
  }

  private requireWriteClient() {
    if (!this.writeClient || !this.account) {
      throw new Error(
        "Wallet not connected. Please connect MetaMask before sending a transaction."
      );
    }

    return this.writeClient;
  }

  private async sendWrite(
    functionName: string,
    args: any[]
  ): Promise<string> {
    const client = this.requireWriteClient();

    const write = {
      address: this.contractAddress,
      functionName,
      args,
    };

    const estimatedFees =
      await client.estimateTransactionFeesForWrite(
        write
      );

    const txHash =
      await client.writeContract({
        ...write,
        fees: {
          distribution:
            estimatedFees.distribution,
          feeValue:
            estimatedFees.feeValue,
        },
      });

    return String(txHash);
  }

  async createCase(
    question: string,
    source1: string,
    source2: string,
    source3: string
  ): Promise<string> {
    return this.sendWrite(
      "create_case",
      [
        question,
        source1,
        source2,
        source3,
      ]
    );
  }

  async resolveCase(
    caseId: number
  ): Promise<string> {
    return this.sendWrite(
      "resolve_case",
      [caseId]
    );
  }

  async waitForAcceptedTransaction(
    txHash: string
  ) {
    return this.readClient.waitForTransactionReceipt(
      {
        hash: txHash,
        status:
          TransactionStatus.ACCEPTED,
      }
    );
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async waitForCaseResolved(
    caseId: number,
    timeoutMs = 300000,
    pollIntervalMs = 5000
  ): Promise<string> {
    const startedAt = Date.now();

    while (
      Date.now() - startedAt <
      timeoutMs
    ) {
      try {
        const status =
          await this.getStatus(caseId);

        if (
          status.trim().toUpperCase() ===
          "RESOLVED"
        ) {
          return await this.getCase(
            caseId
          );
        }
      } catch (error) {
        console.warn(
          "Truth Engine status check failed. Retrying...",
          error
        );
      }

      await this.sleep(
        pollIntervalMs
      );
    }

    throw new Error(
      "Consensus is still processing. The transaction may still complete on-chain."
    );
  }
}

export default TruthEngine;