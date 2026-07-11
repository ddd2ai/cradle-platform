/**
 * artifact-production-transformation.js
 * 
 * Artifact Production Transformation 擴充
 * 支援 Living Context 驅動的 Artifact 重新生成
 */

import { createArtifact } from "./artifact-schema.js";
import { buildArtifactTransformationPrompt } from "./artifact-transformation-prompt.js";

/**
 * 從 Transformation Context 產生 Artifact
 * 用於 Cell Division/Fusion 時重新生成 Artifact
 * 
 * @param {Object} service - ArtifactProductionService 實例
 * @param {Object} options
 * @returns {Promise<Object>} { artifact, saved }
 */
export async function produceFromTransformation(service, {
  type,
  title,
  goal,
  constraints = [],
  livingContext,
  distilledMemory,
  sourceArtifacts = [],
  sourceWarnings = [],
  origin
} = {}) {
  if (!goal?.trim()) {
    throw new Error("produceFromTransformation requires goal");
  }

  if (!livingContext) {
    throw new Error("produceFromTransformation requires livingContext");
  }

  // Step 1: 讀取環境
  const environment = await service.cell.readEnvironment();

  // Step 2: 建立 Transformation Prompt
  const prompt = buildArtifactTransformationPrompt({
    type,
    title,
    goal,
    constraints,
    environment,
    livingContext,
    distilledMemory,
    sourceArtifacts,
    sourceWarnings,
    origin
  });

  // Step 3: 呼叫 AI
  const result = await service.cell.askWithTimeout(prompt, 300000);
  const raw = result?.text ?? result?.answer ?? result ?? "{}";

  // Step 4: Parse
  const parsed = service.parser.parse(raw);

  // Step 5: 建立 Artifact
  const artifactId = `artifact-${service.cell.formatTimestamp(new Date())}`;

  let artifact = createArtifact({
    id: artifactId,
    type: parsed.type ?? type,
    title: parsed.title || title || goal,
    goal: goal,
    cellId: service.cell.id,
    provider: service.cell.provider,
    model: service.cell.model,
    plan: parsed.plan ?? null,
    outputs: parsed.outputs ?? [],
    notes: parsed.notes ?? [],
    origin: origin ? {
      mode: origin.mode || "created",
      sourceCellIds: Array.isArray(origin.sourceCellIds) ? origin.sourceCellIds : [],
      sourceArtifactIds: Array.isArray(origin.sourceArtifactIds) ? origin.sourceArtifactIds : [],
      sourceArtifactRefs: Array.isArray(origin.sourceArtifactRefs) ? origin.sourceArtifactRefs : [],
      livingContextId: origin.livingContextId || null
    } : null
  });

  // Step 6: Normalize
  artifact = service.normalizer.normalize(artifact);

  // Step 7: Validate (with repair once if needed)
  try {
    service.validator.validate(artifact);
  } catch (error) {
    // 嘗試修復一次
    await service.cell.appendThought(`
## ${new Date().toISOString()}

## Artifact Transformation Validation Failed

### Artifact

${artifact.id}

### Error

${error.message}

### Action

Attempting one repair cycle with preserved Living Context and Source Materials.
`);

    // Repair 時保留 Living Context 與 Source Materials
    artifact = await repairTransformationArtifact(service, {
      type,
      goal,
      artifact,
      validationError: error.message,
      livingContext,
      distilledMemory,
      sourceArtifacts,
      sourceWarnings,
      origin
    });

    artifact = service.normalizer.normalize(artifact);
    service.validator.validate(artifact);
  }

  // Step 8: Store
  const saved = await service.store.saveArtifact(artifact);

  // Step 9: 記錄 history
  await service.cell.appendHistory(`
## ${new Date().toISOString()}

### Produced Artifact (Transformation)

- id: ${artifact.id}
- type: ${artifact.type}
- title: ${artifact.title}
- origin: ${origin?.mode || "unknown"}
- dir: ${saved.dir}
`);

  await service.cell.appendThought(`
## ${new Date().toISOString()}

## Artifact Transformation Experience

### Artifact

${artifact.id}

### Type

${artifact.type}

### Goal

${goal}

### Origin

${origin?.mode || "unknown"}

### Growth Impact

This transformation production changed how the cell regenerates artifacts from Living Context and source materials.
`);

  return {
    artifact,
    saved
  };
}

/**
 * 修復 Transformation Artifact
 * 保留 Living Context 與 Source Materials
 */
async function repairTransformationArtifact(service, {
  type,
  goal,
  artifact,
  validationError,
  livingContext,
  distilledMemory,
  sourceArtifacts,
  sourceWarnings = [],
  origin
} = {}) {
  const environment = await service.cell.readEnvironment();

  // 建立 repair prompt (保留 Living Context)
  const prompt = buildArtifactTransformationPrompt({
    type,
    title: artifact.title,
    goal,
    constraints: [
      `Previous validation error: ${validationError}`,
      "Please fix the validation issues while maintaining the Living Context boundaries."
    ],
    environment,
    livingContext,
    distilledMemory,
    sourceArtifacts,
    sourceWarnings,
    origin
  });

  const result = await service.cell.askWithTimeout(prompt, 300000);
  const raw = result?.text ?? result?.answer ?? result ?? "{}";

  const parsed = service.parser.parse(raw);

  const repaired = createArtifact({
    id: artifact.id, // 保留原 artifact id
    type: parsed.type ?? type,
    title: parsed.title || artifact.title || goal,
    goal: goal,
    cellId: service.cell.id,
    provider: service.cell.provider,
    model: service.cell.model,
    plan: parsed.plan ?? null,
    outputs: parsed.outputs ?? [],
    notes: [
      ...(parsed.notes ?? []),
      `Repaired after transformation validation error: ${validationError}`
    ],
    origin: artifact.origin
  });

  return repaired;
}
