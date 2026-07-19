import path from "path";
import { createArtifact } from "./artifact-schema.js";
import { ArtifactStore } from "./artifact-store.js";
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
import { getAiTimeoutMs } from "../cradle-config.js";

export class ArtifactProductionService {
  constructor({
    cell,
    assistant,
    productionsDir,
  } = {}) {
    if (!cell) {
      throw new Error("ArtifactProductionService requires cell");
    }

    if (!assistant) {
      throw new Error("ArtifactProductionService requires assistant");
    }

    this.cell = cell;
    this.assistant = assistant;

    this.store = new ArtifactStore({
      productionsDir,
    });

    this.parser = new ArtifactParser();
    this.normalizer = new ArtifactNormalizer();
    this.validator = new ArtifactValidator();
  }

  async generateArtifactDraft({
    type,
    title,
    goal,
    constraints = [],
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
      getAiTimeoutMs()
    );
    const raw = result?.text ?? result?.answer ?? result ?? "{}";
    
    const parsed = this.parser.parse(raw);

    return this.createArtifactFromParsed({
      parsed,
      type,
      title,
      goal,
    });
  }

  createArtifactFromParsed({
    parsed,
    type,
    title,
    goal,
  } = {}) {
    const artifactId =
      `artifact-${this.cell.formatTimestamp(new Date())}`;

    return createArtifact({
      id: artifactId,
      type: parsed.type ?? type,
      title: parsed.title || title || goal,
      goal: goal, // 強制使用原始 goal,不信任模型改寫的 goal
      cellId: this.cell.id,
      provider: this.cell.provider,
      model: this.cell.model,
      plan: parsed.plan ?? null,
      outputs: parsed.outputs ?? [],
      notes: parsed.notes ?? [],
    });
  }

  async repairArtifact({
    type,
    goal,
    artifact,
    validationError,
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
      getAiTimeoutMs()
    );
    const raw = result?.text ?? result?.answer ?? result ?? "{}";
    
    const parsed = this.parser.parse(raw);

    const repaired = this.createArtifactFromParsed({
      parsed,
      type,
      title: artifact.title,
      goal,
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
    const artifact = await this.store.readArtifact(artifactId);

    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

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
      type: artifact.type,
      goal: artifact.goal,
      artifact,
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
      type: artifact.type,
      title: artifact.title,
      goal: artifact.goal,
    });

    // 保留原 artifact id,讓 /execute <artifact-id> 可以繼續使用同一個 id
    repaired.id = artifact.id;

    repaired.notes = [
      ...(repaired.notes ?? []),
      `Repaired from execution feedback: ${task?.title ?? "(unknown task)"}`,
    ];

    repaired = this.normalizer.normalize(repaired);

    this.validator.validate(repaired);

    const saved = await this.store.saveArtifact(repaired);

    await this.cell.appendHistory(`
## ${new Date().toISOString()}

### Repaired Artifact From Execution

- id: ${repaired.id}
- type: ${repaired.type}
- task: ${task?.id ?? "-"} ${task?.title ?? ""}
- executionStatus: ${executionResult?.status ?? "-"}
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
    };
  }

  /**
   * 從 Transformation Context 產生 Artifact
   * 用於 Cell Division/Fusion 時重新生成 Artifact
   */
  async produceFromTransformation(options) {
    return await _produceFromTransformation(this, options);
  }

  async produce({
    type = "generic",
    title,
    goal,
    constraints = [],
  } = {}) {
    if (!goal?.trim()) {
      throw new Error("produce requires goal");
    }

    // Step 1: Generate draft
    let artifact = await this.generateArtifactDraft({
      type,
      title,
      goal,
      constraints,
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
      });

      // Step 5: Normalize repaired artifact
      artifact = this.normalizer.normalize(artifact);

      // Step 6: Validate again
      this.validator.validate(artifact);
    }

    // Step 7: Store artifact
    const saved = await this.store.saveArtifact(artifact);

    await this.cell.appendHistory(`
## ${new Date().toISOString()}

### Produced Artifact

- id: ${artifact.id}
- type: ${artifact.type}
- title: ${artifact.title}
- dir: ${path.relative(process.cwd(), saved.dir)}
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
