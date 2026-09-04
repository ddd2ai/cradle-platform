import path from "path";
import { randomUUID } from "node:crypto";
import { createArtifact } from "./artifact-schema.js";
import { ArtifactStore } from "./artifact-store.js";
import { PROJECT_ROOT } from "../project-root.js";
import {
  buildProductionPrompt,
  buildArtifactRepairPrompt,
  buildArtifactExecutionRepairPrompt,
} from "./production-prompts.js";
import { buildArtifactTransformationPrompt } from "./artifact-transformation-prompt.js";
import { ArtifactParser } from "./artifact-parser.js";
import { ArtifactNormalizer } from "./artifact-normalizer.js";
import { ArtifactValidator } from "./artifact-validator.js";
import { produceFromTransformation as _produceFromTransformation } from "./artifact-production-transformation.js";
import { produceDivisionProductPair as _produceDivisionProductPair } from "./division-product-pair-production.js";
import { ArtifactIncrementalRepairService } from "./artifact-incremental-repair-service.js";
import { ArtifactIncrementalValidator } from "./artifact-incremental-validator.js";
import { getAiTimeoutMs, getTimeoutMs } from "../cradle-config.js";
import {
  ARTIFACT_OWNER_VIOLATION,
  assertArtifactMutationActor,
} from "./artifact-ownership-policy.js";
import { getArtifactTypePolicy } from "./artifact-type-policy.js";
import { assertSupportedArtifactType } from "./artifact-type-catalog.js";
import { throwIfAborted } from "../utils/abort.js";

export class ArtifactProductionService {
  constructor({
    cell,
    assistant,
    productionsDir,
    artifactCatalogStore = null,
  } = {}) {
    if (!cell) {
      throw new Error("ArtifactProductionService requires cell");
    }

    if (!assistant && typeof cell.askWithTimeout !== "function") {
      throw new Error("ArtifactProductionService requires assistant or cell.askWithTimeout");
    }

    this.cell = cell;
    this.assistant = assistant;

    this.store = new ArtifactStore({
      productionsDir,
      ownerCellId: this.cell.id,
      artifactCatalogStore,
    });

    this.parser = new ArtifactParser();
    this.normalizer = new ArtifactNormalizer();
    this.validator = new ArtifactValidator();
    this.incrementalValidator = new ArtifactIncrementalValidator({
      validator: this.validator,
    });
    this.incrementalRepairService = new ArtifactIncrementalRepairService({
      cell: this.cell,
      store: this.store,
      parser: this.parser,
      validator: this.validator,
      incrementalValidator: this.incrementalValidator,
    });
  }

  async generateArtifactDraft({
    type,
    title,
    goal,
    constraints = [],
    origin = null,
    timeoutMs = getAiTimeoutMs(),
    signal = null,
  } = {}) {
    // 不使用完整的 Memory Context,避免 Vision 干擾 Goal
    // 只提供必要的技術環境資訊
    const environment = await this.cell.readEnvironment();

    const context = `
# Environment (Technical Stack Reference Only)

${environment}

Note: This environment is for reference only. 
The actual artifact MUST follow the current Goal, not any past Vision or History.
`;

    const prompt = buildProductionPrompt({
      type,
      title,
      goal,
      constraints,
      context,
    });

    const result = await this.cell.askWithTimeout(
      prompt,
      timeoutMs,
      { signal },
    );
    const raw = result?.text ?? result?.answer ?? result ?? "{}";
    
    const parsed = this.parser.parse(raw);

    return this.createArtifactFromParsed({
      parsed,
      type,
      title,
      goal,
      origin,
    });
  }

  createArtifactFromParsed({
    parsed,
    type,
    title,
    goal,
    origin = null,
  } = {}) {
    const artifactId =
      `artifact-${this.cell.formatTimestamp(new Date())}`;

    return createArtifact({
      id: artifactId,
      // Artifact type is authoritative operation input. Model output cannot
      // widen the selected capability or switch its validation policy.
      type,
      title: parsed.title || title || goal,
      goal: goal, // 強制使用原始 goal,不信任模型改寫的 goal
      cellId: this.cell.id,
      provider: this.cell.provider,
      model: this.cell.model,
      plan: parsed.plan ?? null,
      outputs: parsed.outputs ?? [],
      notes: parsed.notes ?? [],
      origin,
    });
  }

  async repairArtifact({
    type,
    goal,
    artifact,
    validationError,
    timeoutMs = getAiTimeoutMs(),
    signal = null,
  } = {}) {
    // Repair 時同樣只提供必要環境,避免干擾
    const environment = await this.cell.readEnvironment();

    const context = `
# Environment (Technical Stack Reference Only)

${environment}

Note: This environment is for reference only. 
The actual artifact MUST follow the Original Goal, not any past Vision or History.
`;

    const prompt = buildArtifactRepairPrompt({
      type,
      goal,
      artifact,
      validationError,
      context,
    });

    const result = await this.cell.askWithTimeout(
      prompt,
      timeoutMs,
      { signal },
    );
    const raw = result?.text ?? result?.answer ?? result ?? "{}";
    
    const parsed = this.parser.parse(raw);

    const repaired = this.createArtifactFromParsed({
      parsed,
      type,
      title: artifact.title,
      goal,
      origin: artifact.origin ?? null,
    });

    // 保留原 artifact id,標記為 repaired
    repaired.id = artifact.id;
    repaired.notes = [
      ...(repaired.notes ?? []),
      `Repaired after validation error: ${validationError}`,
    ];

    return repaired;
  }

  async repairArtifactFromExecution({
    artifactId,
    task,
    executionResult,
  } = {}) {
    const repairContext = await this.store.readArtifactRepairContext(artifactId);
    const artifact = repairContext.artifact;

    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    try {
      assertArtifactMutationActor({
        artifact,
        actorCellId: this.cell.id,
        expectedOwnerCellId: this.cell.id,
      });
    } catch (error) {
      if (error?.code === ARTIFACT_OWNER_VIOLATION) {
        this.cell.runtimeMetrics?.increment(
          "artifact_mutation_owner_violation",
          1,
          { cellId: this.cell.id, artifactId }
        );
      }
      throw error;
    }

    const incremental = await this.incrementalRepairService.repairFromExecution({
      artifact,
      task,
      executionResult,
      repairContextMode: repairContext.mode,
    });

    if (incremental.applied) {
      await this.cell.appendHistory(`
## ${new Date().toISOString()}

### Incrementally Repaired Artifact From Execution

- id: ${incremental.artifact.id}
- revision: ${incremental.artifact.revision.revisionId}
- task: ${task?.id ?? "-"} ${task?.title ?? ""}
- executionStatus: ${executionResult?.status ?? "-"}
- changedPaths: ${incremental.changePlan.changes.map((change) => change.path).join(", ")}
`);

      await this.cell.appendThought(`
## ${new Date().toISOString()}

## Incremental Artifact Repair Experience

### Artifact

${incremental.artifact.id}

### Evidence

${executionResult?.status ?? "-"}: ${task?.title ?? "(unknown task)"}

### Change Scope

${incremental.changePlan.changes.map((change) => `- ${change.path}`).join("\n")}
`);

      return {
        artifact: incremental.artifact,
        saved: incremental.saved,
        repairMode: "incremental",
        changePlan: incremental.changePlan,
        impact: incremental.impact,
        changedOutputs: incremental.changedOutputs,
        artifactHydration: incremental.artifactHydration,
      };
    }

    const fullyHydratedArtifact = await this.store.readArtifact(artifactId);

    const environment = await this.cell.readEnvironment();

    const context = `
# Environment (Technical Stack Reference Only)

${environment}

Note:
The actual artifact MUST follow the Original Goal.
Do not replace the goal with the repair task.
The repair task only describes what needs to be fixed.
`;

    const prompt = buildArtifactExecutionRepairPrompt({
      type: fullyHydratedArtifact.type,
      goal: fullyHydratedArtifact.goal,
      artifact: fullyHydratedArtifact,
      task,
      executionResult,
      context,
    });

    const result = await this.cell.askWithTimeout(
      prompt,
      getAiTimeoutMs()
    );
    const raw = result?.text ?? result?.answer ?? result ?? "{}";

    const parsed = this.parser.parse(raw);

    let repaired = this.createArtifactFromParsed({
      parsed,
      type: fullyHydratedArtifact.type,
      title: fullyHydratedArtifact.title,
      goal: fullyHydratedArtifact.goal,
    });

    const revisionCreatedAt = new Date().toISOString();
    repaired = {
      ...fullyHydratedArtifact,
      ...repaired,
      id: fullyHydratedArtifact.id,
      type: fullyHydratedArtifact.type,
      title: fullyHydratedArtifact.title,
      goal: fullyHydratedArtifact.goal,
      createdAt: fullyHydratedArtifact.createdAt,
      origin: fullyHydratedArtifact.origin,
      relations: fullyHydratedArtifact.relations,
      notes: [
      ...(fullyHydratedArtifact.notes ?? []),
      ...(repaired.notes ?? []),
      `Repaired from execution feedback: ${task?.title ?? "(unknown task)"}`,
      `Incremental repair fallback: ${incremental.reason}`,
      ],
      revision: {
        revisionId: `rev-${randomUUID()}`,
        baseRevisionId: fullyHydratedArtifact.revision?.revisionId ?? null,
        mode: "full-repair",
        changedPaths: repaired.outputs
          .filter((output) => output?.kind === "file")
          .map((output) => output.path),
        createdAt: revisionCreatedAt,
      },
      updatedAt: revisionCreatedAt,
    };

    repaired = this.normalizer.normalize(repaired);

    this.validator.validate(repaired);

    const saved = await this.store.saveArtifactRevision(repaired);

    await this.cell.appendHistory(`
## ${new Date().toISOString()}

### Repaired Artifact From Execution

- id: ${repaired.id}
- revision: ${repaired.revision.revisionId}
- type: ${repaired.type}
- task: ${task?.id ?? "-"} ${task?.title ?? ""}
- executionStatus: ${executionResult?.status ?? "-"}
- repairMode: full
- incrementalFallback: ${incremental.reason}
`);

    await this.cell.appendThought(`
## ${new Date().toISOString()}

## Artifact Execution Repair Experience

### Artifact

${repaired.id}

### Task

${task?.title ?? "(unknown task)"}

### Execution Result

${executionResult?.status ?? "-"}

### Growth Impact

This repair changed how the cell improves an artifact after real execution feedback.
`);

    return {
      artifact: repaired,
      saved,
      repairMode: "full",
      incrementalFallback: incremental,
    };
  }

  /**
   * 從 Transformation Context 產生 Artifact
   * 用於 Cell Division/Fusion 時重新生成 Artifact
   */
  async produceFromTransformation(options) {
    return await _produceFromTransformation(this, options);
  }

  async produceDivisionProductPair(options) {
    return await _produceDivisionProductPair(this, options);
  }

  async produce({
    type,
    title,
    goal,
    constraints = [],
    origin = null,
    signal = null,
  } = {}) {
    if (!goal?.trim()) {
      throw new Error("produce requires goal");
    }

    type = assertSupportedArtifactType(type);
    const deadline = Date.now() + getTimeoutMs("cultivationSeconds");

    // Step 1: Generate draft
    let artifact = await this.generateArtifactDraft({
      type,
      title,
      goal,
      constraints,
      origin,
      timeoutMs: remainingBudgetMs(deadline),
      signal,
    });

    // Step 2: Normalize
    artifact = this.normalizer.normalize(artifact);

    // Step 3: Validate
    try {
      this.validator.validate(artifact);
    } catch (error) {
      // Step 4: Repair once if validation failed
      await this.cell.appendThought(`
## ${new Date().toISOString()}

## Artifact Validation Failed

### Artifact

${artifact.id}

### Error

${error.message}

### Action

Attempting one repair cycle.
`);

      artifact = await this.repairArtifact({
        type,
        goal,
        artifact,
        validationError: error.message,
        timeoutMs: remainingBudgetMs(deadline),
        signal,
      });

      // Step 5: Normalize repaired artifact
      artifact = this.normalizer.normalize(artifact);

      // Step 6: Validate again
      this.validator.validate(artifact);
    }

    // Cancellation before this boundary stores no Artifact. Once the
    // authoritative revision is written, completion wins over a late cancel.
    throwIfAborted(signal);

    // Step 7: Store artifact
    const saved = await this.store.saveArtifact(artifact);

    await this.cell.appendHistory(`
## ${new Date().toISOString()}

### Produced Artifact

- id: ${artifact.id}
- type: ${artifact.type}
- title: ${artifact.title}
- dir: ${path.relative(PROJECT_ROOT, saved.dir)}
`);

    await this.cell.appendThought(`
## ${new Date().toISOString()}

## Artifact Production Experience

### Artifact

${artifact.id}

### Type

${artifact.type}

### Goal

${goal}

### Growth Impact

This production changed how the cell transforms intent into artifact.
`);

    await this.cell.mature(1);

    return {
      artifact,
      saved,
    };
  }
}

function remainingBudgetMs(deadline) {
  return Math.max(1, deadline - Date.now());
}
