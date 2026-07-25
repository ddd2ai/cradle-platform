import { CellFusionService } from "../lifecycle/cell-fusion-service.js";

export async function executeFuseCommand({
  engine,
  input,
  fusionServiceFactory = () => new CellFusionService(),
}) {
  const parts = input.trim().split(/\s+/);
  const [command, ...args] = parts;

  if (command === "/merge") {
    console.log("/merge is deprecated. Use /fuse instead.");
  }

  if (args.length < 3) {
    console.log("Usage: /fuse <parent-a> <parent-b> [parent-c...] <new-cell-id>");
    return;
  }

  const childId = args.at(-1);
  const parentIds = args.slice(0, -1);

  const uniqueParentIds = [...new Set(parentIds)];

  if (uniqueParentIds.length !== parentIds.length) {
    throw new Error("Parent cells must not contain duplicate IDs.");
  }

  if (parentIds.includes(childId)) {
    throw new Error("Child ID must not equal a parent cell ID.");
  }

  if (hasCell(engine, childId)) {
    throw new Error(`Child cell already exists: ${childId}`);
  }

  const parentCells = parentIds.map(id => requireCell(engine, id));

  console.log("");
  console.log("🧬 Starting Living Context Fusion...");
  console.log("");

  const service = fusionServiceFactory();

  try {
    const result = await service.fuse({
      engine,
      parentCells,
      childId,
    });

    if (!result.success) {
      console.log("");
      console.log("❌ Fusion failed");
      console.log("");

      for (const error of result.errors ?? []) {
        console.log(`  - ${error.stage}: ${error.message}`);
      }

      return;
    }

    engine.activeCellId = childId;
    await renderFusionResult({
      result,
      parentIds,
    });
  } catch (error) {
    console.log("");
    console.log("❌ Fusion failed");
    console.log("");
    console.log(error.message);
    console.log("");

    if (error.cause) {
      console.log("Cause:");
      console.log(error.cause.message);
    }
  }
}

export function createFusionCommands({
  fusionServiceFactory = () => new CellFusionService(),
} = {}) {
  return [
    {
      name: "/fuse",
      match: (input) => input === "/fuse" || input.startsWith("/fuse "),
      execute: (context) => executeFuseCommand({
        ...context,
        fusionServiceFactory,
      }),
    },

    {
      name: "/merge",
      match: (input) => input === "/merge" || input.startsWith("/merge "),
      execute: (context) => executeFuseCommand({
        ...context,
        fusionServiceFactory,
      }),
    },
  ];
}

async function renderFusionResult({ result, parentIds }) {
  const child = result.child;
  const fusionPlan = result.fusionPlan || {};
  const productionResult = result.productionResult || {};
  const livingContext = await child.readLivingContext();
  const profile = await child.readCellProfile();
  const capabilities = countCapabilityResolutions(fusionPlan.capabilityResolutions);
  const knowledge = countKnowledgeConflicts(fusionPlan.knowledgeConflicts);
  const production = countFusionProductions({
    fusionPlan,
    productionResult,
  });

  console.log("");
  console.log(result.complete ? "✅ Fusion complete" : "⚠️ Fusion created but incomplete");
  console.log("");
  console.log(`Child          : ${child.id}`);
  console.log(`Parents        : ${parentIds.join(", ")}`);
  console.log(`Role           : ${profile.role || "unknown"}`);
  console.log(`Purpose        : ${livingContext.purpose || "unknown"}`);
  console.log("");
  console.log("Capabilities");
  console.log(`  Inherited      : ${capabilities.inherited}`);
  console.log(`  Synthesized    : ${capabilities.synthesized}`);
  console.log(`  Discarded      : ${capabilities.discarded}`);
  console.log("");
  console.log("Knowledge");
  console.log(`  Conflicts      : ${knowledge.conflicts}`);
  console.log(`  Resolved       : ${knowledge.resolved}`);
  console.log("");
  console.log("Production");
  console.log(`  Planned        : ${production.planned}`);
  console.log(`  Produced       : ${production.produced}`);
  console.log(`  Failed         : ${production.failed}`);
  console.log("");
}

function countCapabilityResolutions(capabilityResolutions = []) {
  return {
    inherited: capabilityResolutions.filter(c => c.strategy === "inherit").length,
    synthesized: capabilityResolutions.filter(c => c.strategy === "synthesize").length,
    discarded: capabilityResolutions.filter(c => c.strategy === "discard").length,
  };
}

function countKnowledgeConflicts(knowledgeConflicts = []) {
  return {
    conflicts: knowledgeConflicts.length,
    resolved: knowledgeConflicts.filter(c => c.resolution).length,
  };
}

function countFusionProductions({ fusionPlan, productionResult }) {
  return {
    planned: (fusionPlan.productionPlan || []).length,
    produced: (productionResult.produced || []).length,
    failed: (productionResult.failed || []).length,
  };
}

function hasCell(engine, cellId) {
  if (typeof engine.hasCell === "function") {
    return engine.hasCell(cellId);
  }

  return engine.cells?.has(cellId) ?? false;
}

function requireCell(engine, cellId) {
  if (typeof engine.requireCell === "function") {
    return engine.requireCell(cellId);
  }

  const cell = engine.cells?.get(cellId);

  if (!cell) {
    throw new Error(`Cell not found: ${cellId}`);
  }

  return cell;
}
