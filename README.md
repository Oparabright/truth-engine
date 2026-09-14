# Truth Engine

> **Don’t trust one AI. Ask the consensus.**

Truth Engine is an evidence-backed consensus system built on **GenLayer**.

Instead of trusting a single AI model to answer whether a claim is true, Truth Engine automatically discovers relevant web evidence, submits that evidence to a GenLayer Intelligent Contract, and lets GenLayer validators independently inspect the sources and reach a consensus verdict.

The result is a transparent **Truth Receipt** containing the question, verdict, explanation, evidence summary, and on-chain resolution status.

---

## The Problem

AI systems can sound confident even when they are:

- hallucinating
- using outdated information
- overgeneralizing from related facts
- confusing similar entities or product names
- treating missing evidence as proof
- giving binary answers to questions that are actually contextual

For questions such as:

- “Has Apple officially launched the iPhone 18?”
- “Did the Nigerian contestant win Miss World?”
- “Can rice and plantain be eaten together as part of a healthy diet?”

a single AI answer may not be enough.

Truth Engine introduces an additional verification layer:

**discover evidence → independently evaluate it → reach consensus → produce a receipt**

---

## How It Works

### 1. Ask a question

The user enters a natural-language question in the Truth Engine interface.

No manual source submission is required.

### 2. Automatic evidence discovery

Truth Engine uses **Tavily Search** to discover relevant candidate web sources.

Tavily is used only for **source discovery**.

It does not determine the final truth verdict.

### 3. Create an on-chain Truth Case

The question and discovered evidence URLs are submitted to the Truth Engine Intelligent Contract deployed on GenLayer.

### 4. Independent evidence evaluation

GenLayer validators independently retrieve and evaluate the provided web evidence.

The contract instructs validators to:

- rely only on the supplied evidence
- distinguish related claims from exact claims
- preserve important qualifiers
- treat inaccessible sources as unavailable evidence
- avoid inventing missing information
- prefer uncertainty when evidence is insufficient

### 5. Consensus

GenLayer’s intelligent consensus mechanism determines whether validators sufficiently agree on the result.

### 6. Truth Receipt

The resolved case produces one of four verdicts:

- **TRUE**
- **FALSE**
- **UNRESOLVED**
- **CONTEXTUAL**

The interface then displays the final verdict together with the explanation, evidence summary, and resolution status.

---

## Exact-Claim Reasoning

One of the central design goals of Truth Engine is preventing AI systems from silently changing the question.

For example:

> “Has Apple officially launched the iPhone 18?”

is not automatically equivalent to:

> “Has Apple announced the iPhone 18 Pro?”

Truth Engine requires material details of the original claim to match the evidence.

This includes qualifiers such as:

- officially
- launched
- released
- announced
- available
- first
- only
- won
- standard
- current
- latest
- specific model names
- dates
- locations

If the available evidence supports only a related claim rather than the exact claim, Truth Engine can return:

**UNRESOLVED**

instead of overclaiming.

---

## Verdict Types

### TRUE

The available evidence affirmatively supports the material claim being asked.

### FALSE

The available evidence affirmatively contradicts the material claim.

Absence of proof alone is not automatically treated as proof of falsehood.

### UNRESOLVED

The available evidence is insufficient, inaccessible, conflicting, ambiguous, or does not precisely match the question.

### CONTEXTUAL

The question does not have a responsible universal TRUE/FALSE answer and depends on circumstances, interpretation, or additional context.

This is especially useful for questions involving areas such as nutrition, practical advice, and other nuanced subjects.

---

## Example

Question:

> Has Apple officially launched the iPhone 18?

The evidence discovered for the live MVP included information about **iPhone 18 Pro / Pro Max**, but did not clearly establish that the exact standard **iPhone 18** claim had been satisfied.

Truth Engine therefore returned:

**UNRESOLVED**

rather than broadening the claim and incorrectly returning TRUE.

---

## Architecture

```text
User Question
     |
     v
Next.js Frontend
     |
     v
Tavily Evidence Discovery
     |
     | candidate URLs only
     v
Truth Engine Intelligent Contract
     |
     v
GenLayer Validators
     |
     | independent web retrieval
     | independent reasoning
     v
Intelligent Consensus
     |
     v
On-Chain Verdict
     |
     v
Truth Receipt