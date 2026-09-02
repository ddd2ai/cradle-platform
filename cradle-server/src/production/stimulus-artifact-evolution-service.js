import { parseLooseJsonObject } from "../utils/json.js";
import { getAiTimeoutMs } from "../cradle-config.js";
import { assertArtifactMutationActor } from "./artifact-ownership-policy.js";
import { createArtifactChangePlan } from "./artifact-change-plan.js";
import { ArtifactChangePlanMutationService } from "./artifact-change-plan-mutation-service.js";
import { ArtifactIncrementalValidator } from "./artifact-incremental-validator.js";
import { ArtifactValidator } from "./artifact-validator.js";
import { buildArtifactImpactLookupKeys } from "./artifact-impact-index.js";
import { locateArtifactChangeTargets } from "./artifact-impact-locator.js";

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

  async evaluateAndEvolve({ cell, stimulus, source } = {}) {
    const catalog = await cell.artifactStore.listArtifactSummaries();
    const selection = selectArtifactCandidate({ stimulus, artifacts: catalog.artifacts ?? [] });
    if (selection.decision !== "selected") return selection;

    const artifact = await cell.artifactStore.readArtifact(selection.artifactId);
    assertArtifactMutationActor({ artifact, actorCellId: cell.id, expectedOwnerCellId: cell.id });
    const environment = String(await cell.readEnvironment?.() ?? "").slice(0, 8_000);
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
      candidatePaths: indexed.available && indexed.paths.length > 0 ? indexed.paths : undefined,
    });
    if (located.paths.length === 0) {
      return {
        decision: "needs-attention",
        artifactId: artifact.id,
        reason: "stimulus is relevant to an Artifact, but no safe mutation boundary was found",
      };
    }

    const allowedOutputs = artifact.outputs
      .filter((output) => located.paths.includes(output.path))
      .map((output) => ({ ...output, content: String(output.content ?? "").slice(0, 20_000) }));
    const raw = await cell.askWithTimeout(buildEvolutionPrompt({
      artifact,
      stimulus,
      source,
      allowedOutputs,
      environment,
      evaluatedAt,
    }), getAiTimeoutMs());
    const proposal = parseLooseJsonObject(raw?.text ?? raw?.answer ?? raw ?? "{}");
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
      allowedPaths: located.paths,
      provenance,
    });
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

function buildEvolutionPrompt({ artifact, stimulus, source, allowedOutputs, environment, evaluatedAt }) {
  return `You are proposing a bounded Artifact evolution from one verified Stimulus.

The Artifact goal is immutable. Only exact replacements inside the allowed outputs are permitted.
Return JSON only. If evidence does not require a change, return {"decision":"no-change","reason":"...","changes":[]}.
Otherwise return {"decision":"change","summary":"...","changes":[{"path":"...","replacements":[{"before":"exact existing text","after":"replacement"}]}]}.

Rules:
- Do not add paths or change authoritative IDs, ownership, goal, or provenance.
- Every before value must occur exactly once.
- Change no more than 3 files and use no more than 8 replacements per file.
- Preserve unrelated behavior.

Artifact: ${JSON.stringify({ id: artifact.id, title: artifact.title, goal: artifact.goal })}
Source: ${JSON.stringify({ sourceId: source.sourceId, name: source.originalName, mediaType: source.mediaType })}
Stimulus: ${JSON.stringify({ summary: stimulus.summary, content: stimulus.content })}
Environment at evaluation time ${evaluatedAt}: ${environment || "(not declared)"}
Allowed outputs: ${JSON.stringify(allowedOutputs)}
`;
}
