import crypto from "node:crypto";
import { createArtifact } from "./artifact-schema.js";
import { buildDivisionProductPairPrompt } from "./division-product-pair-prompt.js";
import { DivisionProductContractValidator } from "./division-product-contract-validator.js";
import { getAiTimeoutMs } from "../cradle-config.js";

function resolveStore(cell) {
  const store = cell.artifactStore ?? cell.productionService?.store;

  if (!store || typeof store.saveArtifact !== "function") {
    throw new Error(`Artifact store is required for Cell ${cell.id}`);
  }

  return store;
}

function buildArtifact({
  service,
  targetCell,
  parsed,
  artifactId,
  type,
  title,
  goal,
  origin,
}) {
  return service.normalizer.normalize(createArtifact({
    id: artifactId,
    type: parsed.type ?? type,
    title: parsed.title || title || goal,
    goal,
    cellId: targetCell.id,
    provider: service.cell.provider,
    model: service.cell.model,
    plan: parsed.plan ?? null,
    outputs: parsed.outputs ?? [],
    notes: parsed.notes ?? [],
    origin,
  }));
}

export async function produceDivisionProductPair(service, {
  parentCell,
  childCell,
  type,
  parentTitle,
  childTitle,
  parentGoal,
  childGoal,
  parentLivingContext,
  childLivingContext,
  childMemorySeed,
  sharedContracts = [],
  constraints = [],
  sourceArtifacts = [],
  sourceWarnings = [],
  sourceArtifactIds = [],
} = {}) {
  if (!parentCell || parentCell.id !== service.cell.id) {
    throw new Error("Division product pair must be produced by the parent Cell");
  }
  if (!childCell) {
    throw new Error("produceDivisionProductPair requires childCell");
  }
  if (!parentGoal?.trim() || !childGoal?.trim()) {
    throw new Error("Division product pair requires parentGoal and childGoal");
  }

  const [parentEnvironment, childEnvironment] = await Promise.all([
    parentCell.readEnvironment(),
    childCell.readEnvironment(),
  ]);
  const prompt = buildDivisionProductPairPrompt({
    type,
    parentCellId: parentCell.id,
    childCellId: childCell.id,
    parentTitle,
    childTitle,
    parentGoal,
    childGoal,
    parentLivingContext,
    childLivingContext,
    childMemorySeed,
    sharedContracts,
    constraints,
    parentEnvironment,
    childEnvironment,
    sourceArtifacts,
    sourceWarnings,
  });

  // The parent makes exactly one AI request for both products and their contract.
  const result = await parentCell.askWithTimeout(prompt, getAiTimeoutMs());
  const raw = result?.text ?? result?.answer ?? result ?? "{}";
  const parsed = service.parser.parse(raw);

  if (!parsed.parentProduct || !parsed.childProduct) {
    throw new Error("Division response must contain parentProduct and childProduct");
  }

  const timestamp = parentCell.formatTimestamp(new Date());
  const pairId = crypto.randomUUID().slice(0, 8);
  const commonOrigin = {
    sourceCellIds: [parentCell.id],
    sourceArtifactIds,
    sourceArtifactRefs: [],
    producerCellId: parentCell.id,
  };
  const parentArtifact = buildArtifact({
    service,
    targetCell: parentCell,
    parsed: parsed.parentProduct,
    artifactId: `artifact-${timestamp}-${pairId}-parent`,
    type,
    title: parentTitle,
    goal: parentGoal,
    origin: {
      ...commonOrigin,
      mode: "division-parent-revision",
      targetCellId: parentCell.id,
      livingContextId: `living-context-${parentCell.id}`,
    },
  });
  const childArtifact = buildArtifact({
    service,
    targetCell: childCell,
    parsed: parsed.childProduct,
    artifactId: `artifact-${timestamp}-${pairId}-child`,
    type,
    title: childTitle,
    goal: childGoal,
    origin: {
      ...commonOrigin,
      mode: "division",
      targetCellId: childCell.id,
      livingContextId: `living-context-${childCell.id}`,
    },
  });

  service.validator.validate(parentArtifact);
  service.validator.validate(childArtifact);
  const contractValidator = new DivisionProductContractValidator();
  const productContract = contractValidator.validate({
    parentArtifact,
    childArtifact,
    productContract: structuredClone(parsed.productContract),
  });

  const parentStore = resolveStore(parentCell);
  const childStore = resolveStore(childCell);
  const parentSaved = await parentStore.saveArtifact(parentArtifact);
  const childSaved = await childStore.saveArtifact(childArtifact);

  await parentCell.appendHistory(`
## ${new Date().toISOString()}

### Produced Division Product Pair

- parentProductId: ${parentArtifact.id}
- childProductId: ${childArtifact.id}
- childCellId: ${childCell.id}
`);
  await childCell.appendHistory(`
## ${new Date().toISOString()}

### Received Product From Parent Division

- producerCellId: ${parentCell.id}
- productId: ${childArtifact.id}
`);

  return {
    parentProduct: { artifact: parentArtifact, saved: parentSaved },
    childProduct: { artifact: childArtifact, saved: childSaved },
    productContract,
  };
}
