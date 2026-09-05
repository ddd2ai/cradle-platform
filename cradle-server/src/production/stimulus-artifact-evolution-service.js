import { parseLooseJsonObject } from "../utils/json.js";
import { getAiTimeoutMs } from "../cradle-config.js";
import { assertArtifactMutationActor } from "./artifact-ownership-policy.js";
import { createArtifactChangePlan } from "./artifact-change-plan.js";
import { ArtifactChangePlanMutationService } from "./artifact-change-plan-mutation-service.js";
import { ArtifactIncrementalValidator } from "./artifact-incremental-validator.js";
import { ArtifactValidator } from "./artifact-validator.js";
import { buildArtifactImpactLookupKeys } from "./artifact-impact-index.js";
import { locateArtifactChangeTargets } from "./artifact-impact-locator.js";
import { throwIfAborted } from "../utils/abort.js";

export class StimulusArtifactEvolutionService {
  constructor({ mutationServiceFactory, now = () => new Date() } = {}) {
    this.mutationServiceFactory = mutationServiceFactory ?? ((store) => {
      const validator = new ArtifactValidator();
      return new ArtifactChangePlanMutationService({
        store,
        validator,
        incrementalValidator: new ArtifactIncrementalValidator({ validator }),
      });
    });
    this.now = now;
  }

  async evaluateAndEvolve({ cell, stimulus, source, signal = null } = {}) {
    const catalog = await cell.artifactStore.listArtifactSummaries();
    const selection = selectArtifactCandidate({ stimulus, artifacts: catalog.artifacts ?? [] });
    if (selection.decision !== "selected") return selection;

    const artifact = await cell.artifactStore.readArtifact(selection.artifactId);
    assertArtifactMutationActor({ artifact, actorCellId: cell.id, expectedOwnerCellId: cell.id });
    const foundationContext = await buildFoundationContext(cell);
    const evaluatedAt = this.now().toISOString();
    const task = { title: stimulus.summary, content: stimulus.content };
    const lookupKeys = buildArtifactImpactLookupKeys({ task });
    const indexed = await cell.artifactStore.findArtifactImpactCandidates(
      artifact.id,
      lookupKeys,
      { revisionId: artifact.revision?.revisionId },
    );
    const located = locateArtifactChangeTargets({
      artifact,
      task,
      scope: "artifact",
      candidatePaths: indexed.available && indexed.paths.length > 0 ? indexed.paths : undefined,
    });
    const requiredCodePaths = requiresCodeMutation(artifact)
      ? artifact.outputs
        .filter((output) => isCodeOutput(output))
        .map((output) => output.path)
      : [];
    const mutationPaths = requiredCodePaths.length > 0
      ? requiredCodePaths
      : located.paths;
    if (mutationPaths.length === 0) {
      return {
        decision: "needs-attention",
        artifactId: artifact.id,
        reason: "stimulus is relevant to an Artifact, but no safe mutation boundary was found",
      };
    }

    const allowedOutputs = artifact.outputs
      .filter((output) => mutationPaths.includes(output.path))
      .map((output) => ({ ...output, content: String(output.content ?? "").slice(0, 20_000) }));
    const prompt = buildEvolutionPrompt({
      artifact,
      stimulus,
      source,
      allowedOutputs,
      foundationContext,
      evaluatedAt,
    });
    const proposal = await requestProposal({ cell, prompt, signal });
    throwIfAborted(signal);
    if (proposal.decision === "no-change" || !Array.isArray(proposal.changes) || proposal.changes.length === 0) {
      return {
        decision: "no-change",
        artifactId: artifact.id,
        reason: proposal.reason ?? "Artifact does not require a bounded change",
      };
    }

    const provenance = {
      mode: "stimulus",
      stimulusId: stimulus.stimulusId,
      sourceId: source.sourceId,
      sourceStimulusId: source.stimulusId,
      cellId: cell.id,
      observedAt: stimulus.createdAt,
      evaluatedAt,
    };
    const changePlan = createArtifactChangePlan({
      artifact,
      proposal,
      allowedPaths: [...mutationPaths, "*"],
      provenance,
    });
    throwIfAborted(signal);
    const applied = await this.mutationServiceFactory(cell.artifactStore).apply(changePlan);
    return {
      decision: "evolved",
      artifactId: artifact.id,
      revisionId: applied.artifact.revision.revisionId,
      changedPaths: changePlan.changes.map((change) => change.path),
      validation: applied.validation,
      provenance,
    };
  }
}

async function requestProposal({ cell, prompt, signal }) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const retryInstruction = attempt === 0
        ? ""
        : "Previous response was not valid JSON. Return only one valid JSON object with no markdown or trailing text.";
      const raw = await cell.askWithTimeout(
        `${prompt}\n${retryInstruction}`,
        getAiTimeoutMs(),
        { signal },
      );
      return parseLooseJsonObject(raw?.text ?? raw?.answer ?? raw ?? "{}");
    } catch (error) {
      lastError = error;
      throwIfAborted(signal);
    }
  }

  throw lastError;
}

function selectArtifactCandidate({ stimulus, artifacts }) {
  if (artifacts.length === 0) return { decision: "none", reason: "Cell owns no Artifact" };
  const terms = tokenize([stimulus.summary, stimulus.content]);
  const ranked = artifacts.map((artifact) => {
    const artifactTerms = tokenize([
      artifact.title,
      artifact.goal,
      ...(artifact.outputPaths ?? []),
    ]);
    const matches = [...terms].filter((term) => artifactTerms.has(term));
    return { artifactId: artifact.artifactId, score: matches.length, matches };
  }).sort((a, b) => b.score - a.score || a.artifactId.localeCompare(b.artifactId));
  if (ranked[0].score === 0 && artifacts.length === 1) {
    return { decision: "selected", artifactId: ranked[0].artifactId, reason: "single owned Artifact" };
  }
  if (ranked[0].score === 0) return { decision: "none", reason: "no Artifact relevance evidence" };
  if (ranked[1]?.score === ranked[0].score) {
    return {
      decision: "needs-attention",
      reason: "conflicting Artifact evolution targets have equal evidence",
      candidates: ranked.filter((item) => item.score === ranked[0].score),
    };
  }
  return { decision: "selected", artifactId: ranked[0].artifactId, reason: ranked[0].matches.join(", ") };
}

function tokenize(values) {
  return new Set(values.join("\n").toLowerCase().match(/[\p{L}\p{N}_$.-]{3,}/gu) ?? []);
}

function requiresCodeMutation(artifact) {
  return artifact.type === "code";
}

function isCodeOutput(output) {
  return output?.kind === "file" &&
    !/\.(md|markdown|txt|xml|yml|yaml|json|sql)$/iu.test(String(output.path ?? ""));
}

function buildEvolutionPrompt({ artifact, stimulus, source, allowedOutputs, foundationContext, evaluatedAt }) {
  return `You are proposing a bounded Artifact evolution from one verified Stimulus.

The Artifact goal is immutable. Only exact replacements inside the allowed outputs are permitted.
Return JSON only. If evidence does not require a change, return {"decision":"no-change","reason":"...","changes":[]}.
Otherwise return {"decision":"change","summary":"...","changes":[{"path":"...","replacements":[{"before":"exact existing text","after":"replacement"}]}]}.

Rules:
- New source files may be added as outputs when the requested change requires a new module or package. Provide complete content and language instead of replacements for them.
- Existing files use exact replacements; every before value must occur exactly once.
- Change no more than 3 files and use no more than 8 replacements per file.
- Preserve unrelated behavior.
${requiresCodeMutation(artifact)
    ? "- This is a feature stimulus for a code Artifact. At least one allowed source-code file (not README, migration, or configuration) must be changed."
    : ""}

Artifact: ${JSON.stringify({ id: artifact.id, title: artifact.title, goal: artifact.goal })}
Source: ${JSON.stringify({ sourceId: source.sourceId, name: source.originalName, mediaType: source.mediaType })}
Stimulus: ${JSON.stringify({ summary: stimulus.summary, content: stimulus.content })}
Foundation settings at evaluation time ${evaluatedAt}. Apply Environment as a technical constraint, Vision as direction, and DNA settings as capability and maturity guidance; do not replace the current Stimulus goal:
${foundationContext || "(not declared)"}
Allowed outputs: ${JSON.stringify(allowedOutputs)}
`;
}

async function buildFoundationContext(cell) {
  const [vision, environment, dnaDefinition, dnaFactors] = await Promise.all([
    typeof cell.readVision === "function" ? cell.readVision() : "",
    typeof cell.readEnvironment === "function" ? cell.readEnvironment() : "",
    typeof cell.readDNADefinition === "function" ? cell.readDNADefinition() : [],
    typeof cell.readDNAFactors === "function" ? cell.readDNAFactors() : [],
  ]);

  return JSON.stringify({ vision, environment, dnaDefinition, dnaFactors });
}
