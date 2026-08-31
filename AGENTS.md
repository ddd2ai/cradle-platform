# Cradle Platform Agent Guide

This guide applies to the entire `cradle-platform` workspace.

## Mission

Cradle is a Software Life Engineering platform. Its purpose is not merely to generate code with an LLM. It gives software units a durable identity, explicit boundaries, memory, measurable maturity, observable behavior, and a controlled path for repair and evolution.

The product North Star is to remove routine human proofreading from AI production. Humans define intent, constraints, quality thresholds, and risk policy. Cradle observes a finite set of reproducible indicators and decides whether an Artifact has sufficient quality for its declared purpose. Humans handle policy and exceptional uncertainty, not every generated file.

Every implementation should move Cradle toward this lifecycle:

```text
Intent / Stimulus
       ↓
      Cell
       ↓
    Artifact
       ↓
Validate → Execute → Observe
    ▲                   │
    └──── Repair ───────┘
       ↓
Memory → Maturity → Evolution
```

The biological language is a domain model, not decoration. A concept such as DNA, maturity, metabolism, heartbeat, division, fusion, or evolution must correspond to explicit state, inputs, outputs, policies, and observable effects.

Sufficient quality is a bounded evidence claim, not perfection and not an LLM opinion. When no machine-observable acceptance oracle exists, report insufficient evidence. Never turn plausible model output into an automatic pass.

## Sources of Truth

Use this precedence when sources disagree:

1. The user's current request and explicit constraints.
2. This `AGENTS.md` for project-wide engineering rules.
3. Executed behavior, tests, and current source code.
4. `cradle-server/README.md` for product philosophy and current architecture.
5. Focused documents under `cradle-server/docs/`.
6. Historical implementation reports and generated Cell data.

Historical documents can describe an earlier implementation state. Verify their claims against active source paths before relying on them. When behavior changes, update the primary README or the focused current-state document in the same slice.

## Context and Decision Priority

Keep these concerns distinct:

```text
Current Goal        what this operation must accomplish
Living Context      the Cell's responsibility and boundary
Constraints         rules this operation must not violate
DNA                 capabilities, tendencies, and evolutionary state
Environment         technical conditions the result must fit
Memory / History    experience that informs but does not override the goal
Vision              long-term direction, not an implicit task requirement
```

- Preserve the user's original goal through generation and repair. Do not allow an LLM rewrite to silently replace it.
- Do not inject unrelated Vision or historical context into a focused production request.
- Treat DNA and Memory as durable context, not as permission to expand scope.
- If Goal, Living Context, DNA, and Environment conflict, surface the conflict and resolve it explicitly rather than blending them in a prompt.

## Architectural Invariants

### Cell ownership

- `CradleCell` owns the lifecycle of a software-life unit; an LLM provider does not.
- A Cell's identity, memory, DNA, workspace, tasks, relationships, lifecycle events, snapshots, and evolution history must remain durable across provider changes.
- Put Cell-specific persistence behind the stores and services under `cradle-server/src/cell/`. Avoid adding more direct filesystem responsibilities to `CradleCell` when a focused service or store is appropriate.

### Engine responsibility

- `CradleEngine` is the incubator and coordinator. It supplies the environment, manages Cells, and routes operations.
- The Engine must not silently decide what a Cell should become or absorb Cell-specific business behavior into a central god object.

### Living Context boundaries

- Use Living Context to define purpose, responsibilities, ownership, exclusions, inputs, outputs, constraints, and relationships.
- Division and fusion must produce coherent responsibility boundaries, not just new directories or copied prompts.
- Do not copy an entire parent Memory or production directory into a child. Distill or synthesize Memory and regenerate products for the target Living Context.
- Preserve Artifact origin and parent/child product relationships so evolution remains traceable.

### Artifact pipeline

LLM output is untrusted input. Preserve this separation:

```text
Generate → Parse → Normalize → Validate → Repair → Store → Execute
```

- Parser parses the outer model response.
- Normalizer performs deterministic cleanup and canonicalization.
- Validator accepts or rejects; it does not mutate.
- Store persists only validated artifacts.
- Repair retains the original goal and uses validation or execution evidence.
- The platform, not the model, assigns authoritative IDs, paths, status, and provenance.
- Code is only one Artifact type. Do not hard-code the lifecycle around source code when the same concept applies to documents, tests, specs, diagrams, configuration, decisions, or research.

### Evidence-based quality

- Define a versioned Quality Contract before claiming an Artifact can be judged automatically.
- Keep the indicator set finite, named, and explainable. Prefer a small set of required gates over an opaque aggregate score.
- Every indicator must identify its observation method, expected result, actual result, evidence reference, and observation time.
- Distinguish these outcomes: `sufficient`, `insufficient`, `insufficient_evidence`, and `error`.
- A required-gate failure is not offset by high scores elsewhere.
- Model confidence, self-critique, token probability, or fluent output is not acceptance evidence.
- Repeated execution can establish stability only when the relevant input, Artifact revision, Quality Contract, and Environment identity are known.
- A repair loop must have a bounded budget and detect repeated issue fingerprints. Exhaustion becomes an explicit escalation, not an infinite retry.
- Preserve the evidence bundle with the Artifact so the quality decision can be reproduced and audited.
- Human review is an escalation path for missing or conflicting oracles, policy exceptions, and high-risk acceptance—not a hidden required step for every Artifact.
- Follow `cradle-server/docs/SOFTWARE_LIFE_QUALITY_MODEL.md` when introducing indicators, quality profiles, gates, or publication decisions.

### Provider independence

- Treat Copilot, Ollama, Gemini, Codex, and future LLMs as replaceable adapters.
- Provider-specific SDK objects, response shapes, authentication, or streaming details must not leak into Cell domain state or Artifact schemas.
- A feature is not complete if it works only because of undocumented behavior from one model.

### Controlled autonomy

- Autonomy must be policy-driven, observable, and reversible in proportion to risk.
- `stay` is a no-op; `repair` is a bounded change; `divide` and `fuse` are structural changes.
- Structural lifecycle actions require planning, semantic validation, explicit readiness, and compensation or rollback.
- Preserve manual approval and dry-run boundaries unless the user explicitly asks to change the autonomy policy.
- Do not describe proposal generation as successful evolution. A proposal, an approved action, a completed operation, and verified postconditions are different states.

### Feedback and maturity

- Evolution must be grounded in execution results, observations, repair history, and DNA history—not in arbitrary counters or LLM self-assessment alone.
- A single successful execution is not proof of stability. Keep stability based on repeated evidence and absence of unresolved repair work.
- Maturity must remain explainable from recorded measurements. If its formula changes, migrate or version the meaning and update the UI and documentation together.
- Reflection is useful only when it can inform a later decision without overriding the current goal.

### Runtime state and events

- REST/API state is authoritative for commands and reconciliation.
- WebSocket and SSE runtime events are server-to-client notifications and presentation signals; they do not become an alternate command or state authority.
- Keep protocol details in concrete runtime transport adapters. The transport abstraction should know only the runtime event it publishes.
- Do not refetch all resources on every event. Batch presentation updates, coalesce transient events, and reconcile authoritative state at defined boundaries such as reconnect or operation completion.
- Preserve SSE compatibility until its removal is explicitly approved.

## Workspace Boundaries

The root is a private npm workspace:

- `cradle-server/`: Node.js ESM runtime, CLI, HTTP API, lifecycle, persistence, production, execution, and tests.
- `cradle-web/`: React/Vite observatory and operation UI.

Keep responsibilities aligned:

- Server decides lifecycle behavior and authoritative state.
- Web presents state and sends explicit operation requests.
- Do not invent lifecycle semantics in React from visual state or optimistic guesses.
- Do not create a second API client, event system, or state authority when an active one already exists.

## Implementation Workflow

Before a non-trivial change:

1. Inspect `git status --short` and preserve unrelated user changes.
2. Trace the active path from API or command through use case, service, store, filesystem state, runtime event, and UI consumer as applicable.
3. State which Cradle concept the change implements and what observable behavior will prove it.
4. Separate the requested slice from adjacent refactors or speculative evolution work.

During implementation:

- Prefer small, cohesive, reversible slices.
- Reuse active abstractions and naming where their semantics are still correct.
- When the domain metaphor and implementation disagree, fix or clarify the model rather than adding another synonym.
- For multi-step filesystem operations, plan before mutation, stage incomplete Cells so they are not discoverable, and compensate partial failure.
- Record provenance and lifecycle events at the boundary where an operation becomes authoritative.
- Do not treat HTTP 200, an emitted runtime event, or an LLM response as business success without checking the resulting state.

After implementation, verify in layers appropriate to the change:

```bash
# Server suite
npm test --workspace=cradle-server

# Web behavior
npm test --workspace=cradle-web
npm run lint --workspace=cradle-web
npm run build --workspace=cradle-web

# Patch hygiene
git diff --check
```

Run focused tests first, then the broader relevant suite. For lifecycle or persistence changes, inspect resulting Cell files, Artifact relations, operation status, and rollback behavior. For live UI changes, verify render and network behavior under event load rather than relying only on unit tests.

## Definition of Done

A Cradle feature is complete only when:

- its domain meaning is explicit;
- the authoritative state transition is implemented;
- invalid or partial states are rejected or recoverable;
- the result is observable through the appropriate API, event, CLI, or UI;
- provenance and history are retained where evolution depends on them;
- focused and relevant regression checks pass;
- documentation distinguishes implemented behavior from vision or future work.

For a feature that claims to reduce human proofreading, completion additionally requires:

- a declared Quality Contract for the target Artifact type and purpose;
- machine-observable evidence for every required gate;
- explicit handling of insufficient evidence;
- a bounded repair and escalation policy;
- a reproducible quality decision that does not depend on reading the Artifact manually.

## Common Failure Modes

Avoid these patterns:

- Renaming ordinary CRUD concepts with biological terms without adding lifecycle semantics.
- Letting an LLM response directly mutate authoritative state.
- Treating Memory or Vision as permission to ignore the current Goal.
- Copying parent state during division or concatenating parent contexts during fusion.
- Increasing maturity merely because an operation ran.
- Allowing runtime events to become a second source of truth.
- Automatic structural evolution without policy, validation, and rollback.
- Updating a migration-era file without confirming it is on the active runtime path.
- Claiming self-evolution when only reflection logs or lifecycle proposals exist.
- Replacing required gates with a weighted quality score that can hide a critical failure.
- Treating LLM review of LLM output as independent proof of quality.

## Communication and Scope

- When asked to realize a Cradle philosophy, translate it into domain state, lifecycle transitions, safety policy, persistence, observability, and verification before writing code.
- For substantial changes, first summarize the intended behavior, affected areas, risks, and proof of completion.
- Report adjacent technical debt separately; do not bundle it silently.
- Honor stop, pause, and narrow-revert requests immediately while preserving unrelated work.
- Do not commit unless explicitly asked. When asked, commit only the inspected cohesive slice.
