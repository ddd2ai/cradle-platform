import { getAiTimeoutMs } from "../cradle-config.js";
import {
  applyArtifactChangePlan,
  createArtifactChangePlan,
  hashArtifactContent,
} from "./artifact-change-plan.js";
import { locateArtifactChangeTargets } from "./artifact-impact-locator.js";
import { buildArtifactIncrementalRepairPrompt } from "./production-prompts.js";

export class ArtifactIncrementalRepairService {
  constructor({ cell, store, parser, validator } = {}) {
    if (!cell || !store || !parser || !validator) {
      throw new Error(
        "ArtifactIncrementalRepairService requires cell, store, parser, and validator"
      );
    }
    this.cell = cell;
    this.store = store;
    this.parser = parser;
    this.validator = validator;
  }

  async repairFromExecution({ artifact, task, executionResult } = {}) {
    const impact = locateArtifactChangeTargets({ artifact, task, executionResult });
    if (impact.paths.length === 0) {
      this.#recordFallback("target-not-located");
      return {
        applied: false,
        reason: "target-not-located",
        impact,
      };
    }

    const impactedOutputs = artifact.outputs
      .filter((output) => impact.paths.includes(output.path))
      .map((output) => ({
        path: output.path,
        language: output.language,
        content: output.content,
        contentHash: hashArtifactContent(output.content),
      }));
    const artifactContentBytes = sumContentBytes(artifact.outputs);
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
      const changePlan = createArtifactChangePlan({
        artifact,
        proposal,
        allowedPaths: impact.paths,
      });
      const repaired = applyArtifactChangePlan({ artifact, changePlan });
      this.validator.validate(repaired);
      const saved = await this.store.saveArtifactRevision(repaired);

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
        artifact: repaired,
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
    (total, output) => total + Buffer.byteLength(String(output?.content ?? ""), "utf8"),
    0
  );
}
