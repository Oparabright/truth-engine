# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import json

import genlayer as gl
from genlayer.types import *


class TruthEngine(gl.contract.Contract):
    case_count: u256

    questions: gl.storage.TreeMap[str, str]

    source_1: gl.storage.TreeMap[str, str]
    source_2: gl.storage.TreeMap[str, str]
    source_3: gl.storage.TreeMap[str, str]

    verdicts: gl.storage.TreeMap[str, str]
    explanations: gl.storage.TreeMap[str, str]
    evidence_summaries: gl.storage.TreeMap[str, str]
    statuses: gl.storage.TreeMap[str, str]

    def __init__(self):
        self.case_count = 0

    # ---------------------------------------------------------
    # CREATE CASE
    # ---------------------------------------------------------

    @gl.public.write
    def create_case(
        self,
        question: str,
        source1: str,
        source2: str,
        source3: str,
    ) -> None:

        question = question.strip()

        if question == "":
            raise gl.vm.UserError("Question cannot be empty")

        self.case_count = self.case_count + 1
        case_id = str(self.case_count)

        self.questions[case_id] = question

        self.source_1[case_id] = source1.strip()
        self.source_2[case_id] = source2.strip()
        self.source_3[case_id] = source3.strip()

        self.verdicts[case_id] = ""
        self.explanations[case_id] = ""
        self.evidence_summaries[case_id] = ""
        self.statuses[case_id] = "PENDING"

    # ---------------------------------------------------------
    # RESOLVE CASE
    # ---------------------------------------------------------

    @gl.public.write
    def resolve_case(self, case_id: int) -> None:
        key = str(case_id)

        question = self.questions.get(key, "")

        if question == "":
            raise gl.vm.UserError("Truth Case does not exist")

        if self.statuses.get(key, "") != "PENDING":
            return

        url1 = self.source_1.get(key, "")
        url2 = self.source_2.get(key, "")
        url3 = self.source_3.get(key, "")

        def investigate() -> str:
            evidence = ""
            source_report = ""
            usable_sources = 0

            # SOURCE 1
            if url1 != "":
                try:
                    page1 = gl.nondet.web.render(
                        url1,
                        mode="text"
                    )

                    if page1.strip() != "":
                        evidence += (
                            "\n\n===== SOURCE 1 =====\n"
                            + "URL: "
                            + url1
                            + "\n"
                            + page1[:8000]
                        )

                        source_report += "Source 1: AVAILABLE; "
                        usable_sources += 1
                    else:
                        source_report += "Source 1: EMPTY; "

                except Exception:
                    source_report += "Source 1: UNAVAILABLE; "

            # SOURCE 2
            if url2 != "":
                try:
                    page2 = gl.nondet.web.render(
                        url2,
                        mode="text"
                    )

                    if page2.strip() != "":
                        evidence += (
                            "\n\n===== SOURCE 2 =====\n"
                            + "URL: "
                            + url2
                            + "\n"
                            + page2[:8000]
                        )

                        source_report += "Source 2: AVAILABLE; "
                        usable_sources += 1
                    else:
                        source_report += "Source 2: EMPTY; "

                except Exception:
                    source_report += "Source 2: UNAVAILABLE; "

            # SOURCE 3
            if url3 != "":
                try:
                    page3 = gl.nondet.web.render(
                        url3,
                        mode="text"
                    )

                    if page3.strip() != "":
                        evidence += (
                            "\n\n===== SOURCE 3 =====\n"
                            + "URL: "
                            + url3
                            + "\n"
                            + page3[:8000]
                        )

                        source_report += "Source 3: AVAILABLE; "
                        usable_sources += 1
                    else:
                        source_report += "Source 3: EMPTY; "

                except Exception:
                    source_report += "Source 3: UNAVAILABLE; "

            # No usable web evidence.
            # Do not ask the model to guess.
            if usable_sources == 0:
                return json.dumps(
                    {
                        "verdict": "UNRESOLVED",
                        "explanation":
                            "None of the supplied evidence sources "
                            "could be successfully retrieved.",
                        "evidence_summary": source_report,
                    },
                    sort_keys=True,
                )

            prompt = f"""
You are an evidence evaluator for Truth Engine.

Your job is NOT to answer from memory.

Your job is to evaluate the QUESTION using ONLY the supplied
WEB EVIDENCE.

QUESTION:
{question}

WEB EVIDENCE:
{evidence}

SOURCE RETRIEVAL REPORT:
{source_report}

Choose exactly one verdict:

TRUE
FALSE
UNRESOLVED
CONTEXTUAL


VERDICT DEFINITIONS

TRUE:
The question represents an objectively verifiable factual claim
and the retrieved evidence reliably supports the EXACT material
claim being asked.

FALSE:
The question represents an objectively verifiable factual claim
and the retrieved evidence reliably contradicts the EXACT material
claim being asked.

UNRESOLVED:
The retrieved evidence is insufficient, conflicting, unclear,
outdated, inaccessible, only supports a related claim, or otherwise
cannot justify a reliable conclusion about the EXACT question.

CONTEXTUAL:
The question cannot responsibly be reduced to one universal
TRUE/FALSE answer. The answer depends on context, circumstances,
judgment, preference, lifestyle, preparation, quantity, or other
meaningful conditions.


STRICT RULES

1. Use ONLY the supplied web evidence.

2. Do not use facts remembered from your training data.

3. Never invent products, people, dates, events, quotations,
   statistics, or claims that are absent from the evidence.

4. An inaccessible source is NOT evidence.

5. Prefer UNRESOLVED over guessing.

6. If available sources materially disagree and the conflict
   cannot be resolved from the supplied evidence, return
   UNRESOLVED.

7. Questions about whether something is healthy, advisable,
   preferable, safe in general, or otherwise dependent on
   circumstances will often be CONTEXTUAL.

8. EXACT-CLAIM MATCHING IS REQUIRED.

   Evaluate the precise material claim expressed by the QUESTION.

   Do not treat evidence about a related person, product, model,
   version, organization, event, country, date, category, or variant
   as proof of the exact claim being asked.

   For example:

   Evidence that "iPhone 18 Pro" or "iPhone 18 Pro Max" was launched
   does NOT by itself prove that the standard "iPhone 18" was launched.

   Evidence that one contestant won an event does NOT prove another
   contestant won it.

   Evidence concerning one year, country, event, product variant,
   model, edition, or version does NOT automatically establish a
   claim about another.

9. ENTITY IDENTITY MUST MATCH.

   Identify the central entity or entities in the QUESTION and make
   sure the evidence refers to the same entity.

   Similar names, related models, members of the same product family,
   predecessors, successors, subsidiaries, teams, contestants, or
   associated people must not be treated as interchangeable.

10. QUALIFIERS MUST MATCH.

    Pay special attention to words and phrases such as:

    "officially"
    "standard"
    "first"
    "only"
    "won"
    "launched"
    "released"
    "announced"
    "available"
    "current"
    "latest"
    "today"

    Also pay close attention to dates, locations, model numbers,
    versions, titles, offices, organizations, and event names.

    A qualifier that materially changes the claim must be supported
    by the evidence.

11. DO NOT SILENTLY BROADEN THE QUESTION.

    Do not reinterpret a narrow question as a broader one merely
    because the broader claim is easier to support.

    Example:

    Question:
    "Has Apple officially launched the iPhone 18?"

    Evidence:
    "Apple launched the iPhone 18 Pro."

    This evidence establishes a related claim, but it does not by
    itself establish the exact claim about the standard iPhone 18.

12. TRUE REQUIRES AFFIRMATIVE SUPPORT.

    Return TRUE only when the evidence affirmatively establishes
    the exact material claim in the QUESTION.

    Do not return TRUE merely because the evidence sounds related,
    makes the claim plausible, or establishes a nearby fact.

13. FALSE REQUIRES AFFIRMATIVE CONTRADICTION.

    Return FALSE only when the evidence reliably establishes that
    the exact material claim is false.

    Absence of evidence alone is normally NOT enough to prove FALSE.

    If the evidence simply fails to establish the claim, use
    UNRESOLVED unless the evidence affirmatively contradicts it.

14. DISTINGUISH ANNOUNCEMENT, LAUNCH, RELEASE, AND AVAILABILITY.

    These words may represent different events.

    Evidence that something was announced does not automatically
    prove it was released or available for purchase.

    Evidence that something will launch in the future does not prove
    it has already launched.

    Use the meaning expressed by the QUESTION and the evidence.

15. HANDLE TIME-SENSITIVE CLAIMS CAREFULLY.

    If the QUESTION depends on timing such as "has", "now", "today",
    "currently", or a specific date, make sure the retrieved evidence
    supports the relevant time period.

    Do not use outdated evidence to prove a present-tense claim unless
    it remains sufficient for that claim.

16. RELATED EVIDENCE MAY STILL BE DESCRIBED.

    The evidence_summary may explain that related facts were found,
    but related facts must not be promoted into proof of the exact
    QUESTION.

17. If the exact claim remains ambiguous after reviewing the supplied
    evidence, return UNRESOLVED.

18. Keep the explanation concise.

19. The evidence_summary must describe what the retrieved evidence
    actually established. Do not invent evidence.

Return ONLY valid JSON.

Use exactly this structure:

{{
    "verdict": "TRUE",
    "explanation": "Concise reason for the verdict.",
    "evidence_summary": "Concise summary of the evidence used."
}}
"""

            try:
                result = gl.nondet.exec_prompt(prompt)

                result = (
                    result
                    .replace("```json", "")
                    .replace("```", "")
                    .strip()
                )

                parsed = json.loads(result)

                verdict = str(
                    parsed.get(
                        "verdict",
                        "UNRESOLVED"
                    )
                ).upper().strip()

                explanation = str(
                    parsed.get(
                        "explanation",
                        ""
                    )
                ).strip()

                evidence_summary = str(
                    parsed.get(
                        "evidence_summary",
                        ""
                    )
                ).strip()

                if verdict not in [
                    "TRUE",
                    "FALSE",
                    "UNRESOLVED",
                    "CONTEXTUAL",
                ]:
                    verdict = "UNRESOLVED"

                if explanation == "":
                    explanation = (
                        "The evidence did not produce "
                        "a reliable explanation."
                    )

                if evidence_summary == "":
                    evidence_summary = source_report

                return json.dumps(
                    {
                        "verdict": verdict,
                        "explanation": explanation,
                        "evidence_summary": evidence_summary,
                    },
                    sort_keys=True,
                )

            except Exception:
                return json.dumps(
                    {
                        "verdict": "UNRESOLVED",
                        "explanation":
                            "The evidence evaluation could not "
                            "produce a reliable structured result.",
                        "evidence_summary": source_report,
                    },
                    sort_keys=True,
                )

        # Validators independently investigate the same evidence.
        result = gl.eq_principle.prompt_comparative(
            investigate,
            """
Validate the proposed Truth Engine decision.

The verdict must represent the same substantive conclusion based
on the supplied web evidence.

TRUE, FALSE, UNRESOLVED, and CONTEXTUAL are distinct verdicts.

EXACT-CLAIM VALIDATION IS REQUIRED.

The proposed verdict must answer the precise material claim in the
original QUESTION.

Do not approve a verdict merely because the evidence supports a
related person, product, model, version, organization, event, date,
location, category, or variant.

For example, evidence that the "iPhone 18 Pro" was launched must not
be treated as proof that the standard "iPhone 18" was launched unless
the evidence independently establishes that exact claim.

Verify that central entities, model names, versions, dates, locations,
events, and meaningful qualifiers match the QUESTION.

Do not allow the proposed answer to silently broaden, narrow, or
reinterpret the QUESTION merely to fit the available evidence.

Pay particular attention to qualifiers such as "officially",
"standard", "first", "only", "won", "launched", "released",
"announced", "available", "current", and "latest".

Distinguish announcement from launch, launch from release, and release
from availability when those distinctions matter to the QUESTION.

TRUE requires affirmative evidence supporting the exact material
claim.

FALSE requires affirmative evidence contradicting the exact material
claim.

A lack of evidence alone should normally produce UNRESOLVED rather
than FALSE.

If the evidence only establishes a related claim, leaves the exact
entity ambiguous, or fails to establish an important qualifier,
do not approve TRUE or FALSE. Prefer UNRESOLVED.

Do not approve TRUE or FALSE when the evidence does not reliably
support that exact conclusion.

Do not approve claims that appear to have been invented rather
than derived from the supplied evidence.

Different wording in the explanation or evidence summary is
acceptable when it represents the same substantive conclusion.
""",
        )

        # Defensive final parsing
        try:
            parsed = json.loads(result)

            verdict = str(
                parsed.get(
                    "verdict",
                    "UNRESOLVED"
                )
            ).upper().strip()

            explanation = str(
                parsed.get(
                    "explanation",
                    "The case could not be reliably resolved."
                )
            ).strip()

            evidence_summary = str(
                parsed.get(
                    "evidence_summary",
                    ""
                )
            ).strip()

        except Exception:
            verdict = "UNRESOLVED"
            explanation = (
                "The consensus result could not be reliably parsed."
            )
            evidence_summary = (
                "No reliable evidence summary was produced."
            )

        if verdict not in [
            "TRUE",
            "FALSE",
            "UNRESOLVED",
            "CONTEXTUAL",
        ]:
            verdict = "UNRESOLVED"

        self.verdicts[key] = verdict
        self.explanations[key] = explanation
        self.evidence_summaries[key] = evidence_summary
        self.statuses[key] = "RESOLVED"

    # ---------------------------------------------------------
    # READ METHODS
    # ---------------------------------------------------------

    @gl.public.view
    def get_case_count(self) -> u256:
        return self.case_count

    @gl.public.view
    def get_case(self, case_id: int) -> str:
        key = str(case_id)

        question = self.questions.get(key, "")

        if question == "":
            return "Truth Case not found"

        return (
            "Case ID: "
            + key
            + " | Question: "
            + question
            + " | Verdict: "
            + self.verdicts.get(key, "")
            + " | Explanation: "
            + self.explanations.get(key, "")
            + " | Evidence Summary: "
            + self.evidence_summaries.get(key, "")
            + " | Status: "
            + self.statuses.get(key, "")
        )

    @gl.public.view
    def get_status(self, case_id: int) -> str:
        return self.statuses.get(
            str(case_id),
            ""
        )

    @gl.public.view
    def get_verdict(self, case_id: int) -> str:
        return self.verdicts.get(
            str(case_id),
            ""
        )

    @gl.public.view
    def get_explanation(self, case_id: int) -> str:
        return self.explanations.get(
            str(case_id),
            ""
        )

    @gl.public.view
    def get_evidence_summary(self, case_id: int) -> str:
        return self.evidence_summaries.get(
            str(case_id),
            ""
        )