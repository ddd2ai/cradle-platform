# Software Life Quality Model

> Status: target methodology with a partially implemented foundation. Last reviewed: 2026-08-31.

## Goal

Cradle aims to remove routine human proofreading from AI production.

Humans should not need to open every generated file, manually run every command, and personally decide whether each Artifact is acceptable. Instead, humans define the goal, constraints, risk policy, and quality threshold. Cradle gathers bounded evidence and makes a reproducible quality decision.

```text
Human responsibility
  Goal + Constraints + Quality Contract + Risk Policy
                             │
                             ▼
Cradle responsibility
  Produce → Observe → Decide → Repair → Re-observe
                             │
                             ▼
Outcome
  sufficient | insufficient | insufficient_evidence | error
```

This methodology does not promise perfect output. It makes a narrower and auditable claim:

> An Artifact has sufficient quality for a declared purpose, under a declared environment, because all required observations passed within a defined stability window.

## Why finite indicators

“Quality” cannot remain a vague model judgment. Cradle must reduce it to a finite set of indicators that are:

- named and understandable;
- observable by software;
- reproducible under a known environment;
- connected to the Artifact's intended use;
- strict enough that a critical failure cannot be hidden by unrelated success;
- small enough that operators can understand why a decision was made.

The finite set is not universal. It is selected by a versioned Quality Profile for the Artifact type, purpose, and risk class.

## Core model

### Quality Contract

A Quality Contract defines what evidence is required before an Artifact may be considered sufficient.

```json
{
  "profileId": "java-service-default",
  "version": 1,
  "artifactType": "code",
  "purpose": "executable-service",
  "environmentRef": "environment-sha256:...",
  "requiredIndicators": [
    "contract-integrity",
    "static-validity",
    "behavioral-correctness",
    "execution-fitness",
    "stability"
  ],
  "stabilityWindow": {
    "requiredConsecutivePasses": 2
  },
  "repairBudget": 3,
  "riskClass": "standard"
}
```

The contract is authoritative platform input. An LLM may propose a contract, but it must not silently weaken required gates or acceptance thresholds.

### Quality Observation

Each observation records one indicator and its evidence.

```json
{
  "indicator": "behavioral-correctness",
  "status": "passed",
  "method": "acceptance-test",
  "expected": "all declared scenarios pass",
  "actual": "12 passed, 0 failed",
  "evidenceRef": "quality-evidence/run-.../acceptance.json",
  "artifactRevision": "sha256:...",
  "environmentRef": "environment-sha256:...",
  "observedAt": "2026-08-31T00:00:00.000Z"
}
```

An observation is invalid for the current decision if its Artifact revision, contract version, or relevant environment no longer matches.

### Quality Decision

Use explicit outcomes:

| Outcome | Meaning |
|---|---|
| `sufficient` | Every required gate passed and the stability policy is satisfied. |
| `insufficient` | At least one required gate produced valid failing evidence. |
| `insufficient_evidence` | A required observation could not be made or no acceptance oracle exists. |
| `error` | Cradle failed to complete the observation process itself. |

Do not collapse these outcomes into pass/fail. A broken test runner is different from a test failure, and missing behavioral criteria are different from incorrect behavior.

## Minimal indicator vocabulary

Quality Profiles should select from a small vocabulary and define concrete observers for each selected indicator.

### 1. Contract integrity

Does the Artifact satisfy its declared structure and provenance contract?

Examples:

- schema and required fields;
- allowed paths and file types;
- required outputs present;
- authoritative goal preserved;
- origin and relationship references valid.

### 2. Static validity

Is the Artifact internally well-formed without executing its primary behavior?

Examples:

- parse and syntax checks;
- type checking;
- lint or schema validation;
- forbidden-content and safe-path policies;
- document structure and link validation.

### 3. Behavioral correctness

Does the Artifact satisfy observable acceptance behavior?

Examples:

- contract or acceptance tests;
- example input/output pairs;
- invariant and property checks;
- compatibility tests against declared interfaces;
- required factual claims checked against an authoritative source.

This gate requires an oracle. Generating an answer and asking the same or another LLM whether it looks correct is not independent evidence.

### 4. Execution fitness

Can the Artifact operate in its declared Environment?

Examples:

- build and execution status;
- dependency and runtime compatibility;
- resource limits;
- security or policy checks required by the risk class;
- observable runtime postconditions.

An exit code or HTTP 200 alone is insufficient when business postconditions exist.

### 5. Stability

Does the Artifact continue to pass without producing new unresolved repair work?

Examples:

- consecutive passes for the same revision and environment;
- no new issue fingerprint during the observation window;
- no unresolved blocking task;
- repeatable output where determinism is required.

Stability is evidence accumulated over time. It must not increase merely because a Cell performed unrelated work.

## Decision rule

Use required gates, not compensating averages:

```text
sufficient =
  every required indicator is passed
  AND stability window is satisfied
  AND no blocking issue remains unresolved
  AND all evidence matches the current Artifact revision,
      Quality Contract, and relevant Environment
```

A weighted score may be displayed for diagnosis, but it must not allow high formatting quality to compensate for failing behavior, or high test coverage to compensate for a security gate failure.

## Lifecycle

```text
1. Interpret Goal
2. Resolve Quality Profile
3. Freeze Quality Contract
4. Produce candidate Artifact
5. Collect observations
6. Make quality decision
7. If insufficient: create evidence-backed repair task
8. Repair within budget and re-observe invalidated indicators
9. If sufficient: mark stable/publishable
10. If evidence is missing or budget is exhausted: escalate
```

Repair must address observed evidence while preserving the original Goal. Each repair creates a new Artifact revision and invalidates observations affected by that change.

## Human role

The method removes routine proofreading, not human authority.

Humans remain responsible for:

- defining important goals and constraints;
- approving Quality Profiles and risk policy;
- deciding whether an oracle is adequate for high-risk use;
- resolving conflicting requirements or unavailable evidence;
- accepting explicit exceptions.

Humans should not be required to:

- reread every normal Artifact after every repair;
- manually repeat checks that have deterministic observers;
- infer quality from model fluency;
- discover silently missing evidence after publication.

## Escalation

Escalate instead of claiming success when:

- no machine-observable acceptance oracle exists;
- required sources or environments are unavailable;
- observations conflict;
- the repair budget is exhausted;
- the same issue fingerprint repeats without progress;
- the requested risk policy requires human approval;
- a structural lifecycle action lacks safe rollback or postcondition verification.

The escalation record must state what is known, what is missing, what was attempted, and which decision requires human authority.

## Current foundation

Cradle already contains parts of this model:

- Artifact parsing, normalization, validation, repair, storage, and execution;
- Stability Records and issue fingerprints;
- execution observations and repair tasks;
- Artifact origin and product relationships;
- lifecycle policies, operations, events, and rollback for structural changes.

The full methodology is not yet complete. Major remaining capabilities include:

- a versioned Quality Contract and profile registry;
- a normalized observation and evidence schema;
- Artifact revision and Environment identity binding;
- per-Artifact-type observer adapters;
- one authoritative Quality Decision service;
- evidence invalidation after changes;
- bounded repair budgets and explicit escalation state;
- API and UI presentation of gates, evidence, and decision reasons.

Until those capabilities exist, existing validation or stability status must not be described as proof that all AI output no longer needs human proofreading.

## Implementation order

1. Define schemas for Quality Contract, Observation, Evidence Reference, and Decision.
2. Implement a deterministic decision engine with explicit insufficient-evidence handling.
3. Adapt current parser, validator, executor, Stability Store, and issue fingerprints into observers.
4. Bind evidence to Artifact revision, contract version, and Environment identity.
5. Add bounded repair orchestration and escalation.
6. Expose the decision and evidence through API and UI.
7. Add Quality Profiles for one narrow Artifact purpose before generalizing.
8. Validate the method with real artifacts and failure injection.

Start narrow. A trustworthy profile for one well-defined Artifact purpose is more valuable than a universal quality score with weak evidence.
