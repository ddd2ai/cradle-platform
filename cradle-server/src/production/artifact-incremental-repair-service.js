import { getAiTimeoutMs } from "../cradle-config.js";
import {
  applyArtifactChangePlan,
  createArtifactChangePlan,
  hashArtifactContent,
} from "./artifact-change-plan.js";
import { locateArtifactChangeTargets } from "./artifact-impact-locator.js";
import { buildArtifactIncrementalRepairPrompt } from "./production-prompts.js";
import {
  buildArtifactImpactLookupKeys,
  buildArtifactImpactTerms,
  evolveArtifactRepairHead,
} from "./artifact-impact-index.js";

export class ArtifactIncrementalRepairService {
  constructor({ cell, store, parser, validator, incrementalValidator } = {}) {
    if (!cell || !store || !parser || !validator || !incrementalValidator) {
      throw new Error(
        "ArtifactIncrementalRepairService requires cell, store, parser, validator, and incrementalValidator"
      );
    }
    this.cell = cell;
    this.store = store;
    this.parser = parser;
    this.validator = validator;
    this.incrementalValidator = incrementalValidator;
  }

  async repairFromExecution({
    artifact,
    task,
    executionResult,
    repairContextMode = "manifest-fallback",
  } = {}) {
    const lookupKeys = buildArtifactImpactLookupKeys({ task, executionResult });
    if (artifact.singleOutputPath) {
      lookupKeys.push(...buildArtifactImpactTerms({
        kind: "file",
        path: artifact.singleOutputPath,
      }));
    }
    const indexedCandidates = await this.store.findArtifactImpactCandidates(
      artifact.id,
      lookupKeys,
      { revisionId: artifact.revision?.revisionId }
    );
    const locatorArtifact = indexedCandidates.available
      ? { ...artifact, outputs: indexedCandidates.outputs ?? [] }
      : artifact;
    const impact = locateArtifactChangeTargets({
      artifact: locatorArtifact,
      task,
      executionResult,
      candidatePaths: indexedCandidates.available
        ? indexedCandidates.paths
        : undefined,
    });
    if (indexedCandidates.ambiguous) {
      impact.reason = "indexed candidate set exceeded safe incremental limit";
    }
    this.cell.runtimeMetrics?.increment(
      "artifact_repair_context",
      1,
      { cellId: this.cell.id, mode: repairContextMode }
    );
    impact.lookupMode = indexedCandidates.available ? "indexed" : "scan-fallback";
    this.cell.runtimeMetrics?.increment(
      "artifact_impact_lookup",
      1,
      {
        cellId: this.cell.id,
        mode: impact.lookupMode,
        matched: impact.paths.length > 0 ? "yes" : "no",
      }
    );
    this.cell.runtimeMetrics?.observe(
      "artifact_impact_lookup_key_count",
      indexedCandidates.lookupCount,
      { cellId: this.cell.id, mode: impact.lookupMode }
    );
    if (indexedCandidates.ambiguous) {
      this.cell.runtimeMetrics?.increment(
        "artifact_impact_candidate_overflow",
        1,
        { cellId: this.cell.id }
      );
    }
    this.cell.runtimeMetrics?.observe(
      "artifact_impact_candidate_ratio",
      (artifact.outputCount ?? artifact.outputs?.length)
        ? indexedCandidates.paths.length /
          (artifact.outputCount ?? artifact.outputs.length)
        : 0,
      { cellId: this.cell.id, mode: impact.lookupMode }
    );
    this.cell.runtimeMetrics?.observe(
      "artifact_impact_index_coverage",
      indexedCandidates.available ? 1 : 0,
      { cellId: this.cell.id }
    );
    if (impact.paths.length === 0) {
      this.#recordFallback("target-not-located");
      return {
        applied: false,
        reason: "target-not-located",
        impact,
      };
    }

    const hydratedOutputs = await this.store.readArtifactOutputs(
      artifact.id,
      impact.paths,
      { manifest: locatorArtifact }
    );
    const hydratedByPath = new Map(
      hydratedOutputs.map((output) => [output.path, output])
    );
    const impactedOutputs = hydratedOutputs
      .map((output) => ({
        path: output.path,
        language: output.language,
        content: output.content,
        contentHash: hashArtifactContent(output.content),
      }));
    const artifactContentBytes = Number(
      artifact.contentBytes ?? sumContentBytes(artifact.outputs)
    );
    const impactedContentBytes = sumContentBytes(impactedOutputs);
    this.cell.runtimeMetrics?.observe(
      "artifact_repair_input_scope_ratio",
      artifactContentBytes === 0 ? 0 : impactedContentBytes / artifactContentBytes,
      { cellId: this.cell.id }
    );
    this.cell.runtimeMetrics?.increment(
      "artifact_repair_content_bytes_avoided",
      Math.max(0, artifactContentBytes - impactedContentBytes),
      { cellId: this.cell.id }
    );
    this.cell.runtimeMetrics?.increment(
      "artifact_incremental_selective_hydration_bytes",
      impactedContentBytes,
      { cellId: this.cell.id }
    );
    const environment = await this.cell.readEnvironment();
    const prompt = buildArtifactIncrementalRepairPrompt({
      type: artifact.type,
      goal: artifact.goal,
      task,
      executionResult,
      impactedOutputs,
      context: [
        "# Environment (Technical Stack Reference Only)",
        environment,
        "The Original Goal and allowed output boundaries remain authoritative.",
      ].join("\n\n"),
    });

    try {
      const result = await this.cell.askWithTimeout(prompt, getAiTimeoutMs());
      const raw = result?.text ?? result?.answer ?? result ?? "{}";
      const proposal = this.parser.parse(raw);
      const usesRepairHead = repairContextMode === "head";
      const repairBase = usesRepairHead
        ? { ...artifact, outputs: hydratedOutputs }
        : {
            ...artifact,
            outputs: artifact.outputs.map(
              (output) => hydratedByPath.get(output.path) ?? output
            ),
          };
      const changePlan = createArtifactChangePlan({
        artifact: repairBase,
        proposal,
        allowedPaths: impact.paths,
      });
      let repaired = applyArtifactChangePlan({
        artifact: repairBase,
        changePlan,
      });
      const incrementalValidation = this.incrementalValidator.validate({
        artifact: repaired,
        changePlan,
        baseHead: usesRepairHead ? artifact : undefined,
        baseOutputs: usesRepairHead ? hydratedOutputs : undefined,
      });
      let saved;
      if (incrementalValidation.requiresFullValidation) {
        this.cell.runtimeMetrics?.increment(
          "artifact_incremental_full_validation_fallback",
          1,
          {
            cellId: this.cell.id,
            reason: incrementalValidation.reason,
          }
        );
        const fullyHydratedArtifact = await this.store.readArtifact(artifact.id);
        repaired = applyArtifactChangePlan({
          artifact: fullyHydratedArtifact,
          changePlan,
        });
        this.validator.validate(repaired);
        saved = await this.store.saveArtifactRevision(repaired);
      } else if (usesRepairHead) {
        const nextHead = evolveArtifactRepairHead({
          baseHead: artifact,
          artifact: repaired,
          previousOutputs: hydratedOutputs,
          nextOutputs: repaired.outputs,
        });
        saved = await this.store.saveArtifactDelta({
          artifact: repaired,
          baseHead: artifact,
          nextHead,
        });
        this.cell.runtimeMetrics?.increment(
          "artifact_flat_manifest_reads_avoided",
          1,
          { cellId: this.cell.id }
        );
      } else {
        saved = await this.store.saveArtifactRevision(repaired);
      }
      this.cell.runtimeMetrics?.increment(
        "artifact_revision_storage",
        1,
        { cellId: this.cell.id, mode: saved.storageMode ?? "full" }
      );
      if (saved.mutationLease) {
        this.cell.runtimeMetrics?.observe(
          "artifact_mutation_lease_wait_ms",
          saved.mutationLease.waitMs,
          { cellId: this.cell.id }
        );
        if (saved.mutationLease.contentionCount > 0) {
          this.cell.runtimeMetrics?.increment(
            "artifact_mutation_lease_contention",
            saved.mutationLease.contentionCount,
            { cellId: this.cell.id }
          );
        }
        if (saved.mutationLease.staleRecovered > 0) {
          this.cell.runtimeMetrics?.increment(
            "artifact_mutation_stale_lease_recovered",
            saved.mutationLease.staleRecovered,
            { cellId: this.cell.id }
          );
        }
      }
      if (saved.compaction) {
        if (Number.isSafeInteger(saved.compaction.deltaDepth)) {
          this.cell.runtimeMetrics?.observe(
            "artifact_revision_delta_depth",
            saved.compaction.deltaDepth,
            { cellId: this.cell.id }
          );
        }
        this.cell.runtimeMetrics?.increment(
          "artifact_revision_compaction",
          1,
          {
            cellId: this.cell.id,
            result: saved.compaction.performed
              ? "performed"
              : saved.compaction.error
                ? "failed"
                : "deferred",
            reason: saved.compaction.reason,
          }
        );
      }
      this.cell.runtimeMetrics?.increment(
        "artifact_impact_index_sync",
        1,
        {
          cellId: this.cell.id,
          mode: saved.impactIndex?.mode ?? "unknown",
          updated: saved.impactIndex?.updated ? "yes" : "no",
        }
      );
      const persistedContext = await this.store.readArtifactRepairContext(
        artifact.id
      );
      const changedOutputs = repaired.outputs.filter(
        (output) => changePlan.changes.some((change) => change.path === output.path)
      );

      this.cell.runtimeMetrics?.increment("artifact_incremental_repair_applied", 1, {
        cellId: this.cell.id,
      });
      this.cell.runtimeMetrics?.increment(
        "artifact_incremental_files_changed",
        changePlan.changes.length,
        { cellId: this.cell.id }
      );
      this.cell.runtimeMetrics?.increment(
        "artifact_incremental_replacements_applied",
        changePlan.changes.reduce(
          (total, change) => total + change.replacements.length,
          0
        ),
        { cellId: this.cell.id }
      );
      return {
        applied: true,
        artifact: persistedContext.artifact,
        artifactHydration: persistedContext.mode,
        changedOutputs,
        saved,
        changePlan,
        impact,
      };
    } catch (error) {
      this.#recordFallback("invalid-or-failed-patch");
      return {
        applied: false,
        reason: "invalid-or-failed-patch",
        error: error.message,
        impact,
      };
    }
  }

  #recordFallback(reason) {
    this.cell.runtimeMetrics?.increment("artifact_incremental_repair_fallback", 1, {
      cellId: this.cell.id,
      reason,
    });
  }
}

function sumContentBytes(outputs = []) {
  return outputs.reduce(
    (total, output) => total + (
      typeof output?.content === "string"
        ? Buffer.byteLength(output.content, "utf8")
        : Number(output?.contentBytes ?? 0)
    ),
    0
  );
}
