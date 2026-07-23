// test/test-cell-fusion-service.js

/**
 * CellFusionService 測試
 * 
 * 使用 Fake 實作，不呼叫真實 AI
 */

import { CellFusionService } from "../src/lifecycle/cell-fusion-service.js";

const successfulArtifactRegenerationService = {
  async regenerateForFusion() {
    return {
      produced: [],
      failed: [],
      skipped: [],
      complete: true,
    };
  },
};

function createCellFusionService(options = {}) {
  return new CellFusionService({
    artifactRegenerationService: successfulArtifactRegenerationService,
    ...options,
  });
}

// Fake Engine
class FakeEngine {
  constructor() {
    this.cells = new Map();
    this.createdCells = [];
  }

  async createCell(childId) {
    const cell = new FakeCell(childId);
    this.cells.set(childId, cell);
    this.createdCells.push(childId);
    return cell;
  }
}

// Fake Cell
class FakeCell {
  constructor(id) {
    this.id = id;
    this.dnaVector = {
      PERCEPTION: { strength: 0.8, stability: 0.7, plasticity: 0.6, fitness: 0.5 },
      DECISION: { strength: 0.7, stability: 0.6, plasticity: 0.5, fitness: 0.4 },
      DECOMPOSITION: { strength: 0.6, stability: 0.5, plasticity: 0.4, fitness: 0.3 },
      LEARNING: { strength: 0.5, stability: 0.4, plasticity: 0.3, fitness: 0.2 },
      COLLABORATION: { strength: 0.4, stability: 0.3, plasticity: 0.2, fitness: 0.1 },
      CREATION: { strength: 0.3, stability: 0.2, plasticity: 0.1, fitness: 0.0 },
      EVOLUTION: { strength: 0.2, stability: 0.1, plasticity: 0.0, fitness: 0.1 },
      REFLECTION: { strength: 0.1, stability: 0.0, plasticity: 0.1, fitness: 0.2 },
    };
    this.dnaHistory = [{ vector: this.dnaVector, at: new Date().toISOString() }];
    this.livingContext = null;
    this.memory = {};
    this.history = [];
    this.thoughts = [];
    this.memoryDir = `/tmp/cradle-platform-test/${id}/memory`;
    this.thoughtsDir = `/tmp/cradle-platform-test/${id}/thoughts`;
    this.memoryFiles = {
      identity: `${this.memoryDir}/identity.md`,
      rules: `${this.memoryDir}/rules.md`,
      knowledge: `${this.memoryDir}/knowledge.md`,
      history: `${this.memoryDir}/history.md`,
    };
    this.responsibilities = [];
    this.relationships = [];
    this.generation = 1;
    this.profile = {
      generation: 1,
      role: null,
    };

    // 用於追蹤 method 呼叫
    this.methodCalls = {
      createFusionPlanByDNA: 0,
      applyFusionPlanByDNA: 0,
      appendDNAHistoryIfChanged: 0,
      setResponsibilities: 0,
      writeLivingContext: 0,
      writeMemory: 0,
      appendHistory: 0,
      appendThought: 0,
      addRelationship: 0,
    };
  }

  async createFusionPlanByDNA({ parentCells, childId, parentWeights = {} }) {
    this.methodCalls.createFusionPlanByDNA++;

    return {
      fusedMatrix: [[0.7, 0.6, 0.5]],
      fusedVector: {
        TEST_TRAIT: { strength: 0.7, stability: 0.6, plasticity: 0.5 },
      },
      maturity: 0.6,
      role: "Unified Role",
      dominantTraits: ["TEST_TRAIT"],
      dominantFactors: ["TEST_TRAIT.strength"],
      reason: "Fusion from test parents",
      parentWeights: parentCells.map(cell => ({
        cellId: cell.id,
        weight: parentWeights[cell.id] || 1,
      })),
    };
  }

  async applyFusionPlanByDNA({ childCell, parentCells, dnaFusionPlan }) {
    this.methodCalls.applyFusionPlanByDNA++;

    // 寫入 Child DNA
    await childCell.writeDNAVector(dnaFusionPlan.fusedVector);
    await childCell.appendDNAHistory(`fusion from ${parentCells.map(c => c.id).join(", ")}`);

    // 設定 Generation
    let maxGeneration = 0;
    for (const parent of parentCells) {
      maxGeneration = Math.max(maxGeneration, parent.profile.generation || 0);
    }

    childCell.profile.generation = maxGeneration + 1;
    childCell.profile.role = dnaFusionPlan.role;
  }

  async writeDNAVector(vector) {
    this.dnaVector = vector;
  }

  async readDNAVector() {
    return this.dnaVector;
  }

  async readDNAHistory() {
    return this.dnaHistory;
  }

  async appendDNAHistory(reason) {
    this.dnaHistory.push({ reason, at: new Date().toISOString() });
  }

  async appendDNAHistoryIfChanged(reason) {
    this.methodCalls.appendDNAHistoryIfChanged++;
    await this.appendDNAHistory(reason);
  }

  async readCellProfile() {
    return this.profile;
  }

  async writeCellProfile(profile) {
    this.profile = profile;
  }

  async readLivingContext() {
    return this.livingContext;
  }

  async writeLivingContext(context) {
    this.methodCalls.writeLivingContext++;
    this.livingContext = context;
  }

  async writeMemory(name, content) {
    this.methodCalls.writeMemory++;
    this.memory[name] = content;
  }

  async appendHistory(content) {
    this.methodCalls.appendHistory++;
    this.history.push(content);
  }

  async appendThought(content) {
    this.methodCalls.appendThought++;
    this.thoughts.push(content);
  }

  async setResponsibilities(responsibilities) {
    this.methodCalls.setResponsibilities++;
    this.responsibilities = [...responsibilities];
  }

  async addRelationship(type, target) {
    this.methodCalls.addRelationship++;
    this.relationships.push({ type, target });
  }

  async listRelationships() {
    return this.relationships;
  }

  async askWithTimeout(prompt, timeout) {
    throw new Error("askWithTimeout should not be called in Fake");
  }
}

// Fake LivingContextFusionService
class FakeLivingContextFusionService {
  constructor({ requesterCell }) {
    this.requesterCell = requesterCell;
    this.createFusionPlanCalled = false;
  }

  async createFusionPlan({ parentCells, childId, dnaFusionPlan }) {
    this.createFusionPlanCalled = true;

    return {
      type: "living-context-fusion",
      parentCellIds: parentCells.map(cell => cell.id),
      childCellId: childId,
      fusedLivingContext: {
        id: `living-context-${childId}`,
        cellId: childId,
        purpose: "Unified payment lifecycle",
        responsibilities: ["Payment", "Order"],
        owns: [],
        excludes: [],
        inputs: [],
        outputs: [],
        constraints: [],
        relationships: [],
      },
      fusedMemorySeed: {
        knowledge: "Test fused knowledge",
        thought: "Test fused thought",
      },
    };
  }
}

// ===== 測試 =====

async function test01_DNAPlanningBeforeCreateCell() {
  console.log("\n=== Test 01: DNA Planning 在 createCell 前完成 ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  let dnaPlanningCalled = false;
  const service = createCellFusionService({
    dnaFusionService: {
      createPlan: async () => {
        dnaPlanningCalled = true;
        console.assert(engine.createdCells.length === 0, "Child should not exist yet");
        return {
          type: "dna-fusion",
          parentCellIds: [parentA.id, parentB.id],
          childCellId: "child-fused",
          fusedVector: parentA.dnaVector,
          role: "Unified Role",
        };
      },
      applyPlan: async ({ childCell, plan }) => {
        await childCell.writeDNAVector(plan.fusedVector);
        await childCell.appendDNAHistoryIfChanged(
          `fusion from ${plan.parentCellIds.join(", ")}`
        );
      },
    },
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  console.assert(result.success, "Fusion should succeed");
  console.assert(result.complete, "Fusion should be complete");
  console.assert(dnaPlanningCalled, "DNA planning should be called once");
  
  console.log("✅ DNA planning called before createCell");
}

async function test02_LivingContextPlanningBeforeCreateCell() {
  console.log("\n=== Test 02: Living Context Planning 在 createCell 前完成 ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  let planningCalled = false;

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      const fake = new FakeLivingContextFusionService({ requesterCell });
      const original = fake.createFusionPlan.bind(fake);
      fake.createFusionPlan = async (...args) => {
        planningCalled = true;
        console.assert(engine.createdCells.length === 0, "Child should not exist yet");
        return await original(...args);
      };
      return fake;
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  console.assert(planningCalled, "Living Context planning should be called");
  console.log("✅ Living Context planning called before createCell");
}

async function test03_DNAPlanningFailureNoChild() {
  console.log("\n=== Test 03: DNA Planning 失敗時不建立 Child ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    dnaFusionService: {
      createPlan: async () => {
        throw new Error("DNA planning failed");
      },
    },
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  let error = null;
  try {
    await service.fuse({
      engine,
      parentCells: [parentA, parentB],
      childId: "child-fused",
    });
  } catch (e) {
    error = e;
  }

  console.assert(error !== null, "Should throw error");
  console.assert(error.message.includes("planning failed"), "Error should mention planning");
  console.assert(engine.createdCells.length === 0, "Child should not be created");
  
  console.log("✅ DNA planning failure prevents Child creation");
}

async function test04_LivingContextPlanningFailureNoChild() {
  console.log("\n=== Test 04: Living Context Planning 失敗時不建立 Child ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return {
        createFusionPlan: async () => {
          throw new Error("Living Context planning failed");
        },
      };
    },
  });

  let error = null;
  try {
    await service.fuse({
      engine,
      parentCells: [parentA, parentB],
      childId: "child-fused",
    });
  } catch (e) {
    error = e;
  }

  console.assert(error !== null, "Should throw error");
  console.assert(engine.createdCells.length === 0, "Child should not be created");
  
  console.log("✅ Living Context planning failure prevents Child creation");
}

async function test05_ChildAlreadyExistsFails() {
  console.log("\n=== Test 05: Child 已存在時失敗 ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");
  
  // 預先建立 Child
  await engine.createCell("child-fused");

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  let error = null;
  try {
    await service.fuse({
      engine,
      parentCells: [parentA, parentB],
      childId: "child-fused",
    });
  } catch (e) {
    error = e;
  }

  console.assert(error !== null, "Should throw error");
  console.assert(error.message.includes("already exists"), "Error should mention already exists");
  
  console.log("✅ Fusion fails when Child already exists");
}

async function test06_ChildSuccessfullyCreated() {
  console.log("\n=== Test 06: Child 成功建立 ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  console.assert(result.success, "Fusion should succeed");
  console.assert(result.child, "Child should be created");
  console.assert(result.child.id === "child-fused", "Child ID should match");
  console.assert(engine.createdCells.length === 1, "One child should be created");
  console.assert(engine.createdCells[0] === "child-fused", "Child ID should be correct");
  
  console.log("✅ Child successfully created");
}

async function test07_ApplyFusionPlanByDNACalled() {
  console.log("\n=== Test 07: DNA apply plan 被呼叫一次 ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  console.assert(
    result.child.methodCalls.appendDNAHistoryIfChanged === 1,
    "DNA apply should append child DNA history once"
  );
  
  console.log("✅ DNA apply plan called once");
}

async function test08_FusedLivingContextWritten() {
  console.log("\n=== Test 08: Fused Living Context 被寫入 ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  const child = result.child;

  console.assert(child.livingContext !== null, "Living Context should be written");
  console.assert(child.livingContext.cellId === "child-fused", "Living Context cellId should match");
  console.assert(
    child.livingContext.purpose === "Unified payment lifecycle",
    "Living Context purpose should match"
  );
  
  console.log("✅ Fused Living Context written to Child");
}

async function test09_ChildResponsibilitiesReplaced() {
  console.log("\n=== Test 09: Child responsibilities 被 replace ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  const child = result.child;

  console.assert(child.methodCalls.setResponsibilities === 1, "setResponsibilities should be called once");
  console.assert(
    JSON.stringify(child.responsibilities) === JSON.stringify(["Payment", "Order"]),
    "Responsibilities should match fusion plan"
  );
  
  console.log("✅ Child responsibilities replaced");
}

async function test10_FusedMemorySeedWritten() {
  console.log("\n=== Test 10: Fused Memory Seed 被寫入 ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  const child = result.child;

  console.assert(child.memory.identity, "Identity should be written");
  console.assert(child.memory.identity.includes("child-fused"), "Identity should mention child ID");
  console.assert(child.memory.identity.includes("parent-a"), "Identity should mention parent-a");
  console.assert(child.memory.identity.includes("parent-b"), "Identity should mention parent-b");

  console.assert(child.memory.knowledge, "Knowledge should be written");
  console.assert(
    child.memory.knowledge.includes("Test fused knowledge"),
    "Knowledge should include fused seed"
  );

  console.assert(child.memory.history, "History should be written");
  console.assert(child.memory.history.includes("Birth by Cell Fusion"), "History should mention birth");

  console.assert(child.thoughts.length > 0, "Thought should be appended");
  
  console.log("✅ Fused Memory Seed written to Child");
}

async function test11_ParentMemoryNotModified() {
  console.log("\n=== Test 11: Parent Memory 沒被修改 ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  parentA.memory.identity = "Original A identity";
  parentB.memory.identity = "Original B identity";

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  console.assert(
    parentA.memory.identity === "Original A identity",
    "Parent A identity should not change"
  );
  console.assert(
    parentB.memory.identity === "Original B identity",
    "Parent B identity should not change"
  );
  
  console.log("✅ Parent Memory not modified");
}

async function test12_ParentLivingContextNotModified() {
  console.log("\n=== Test 12: Parent Living Context 沒被修改 ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  parentA.livingContext = { cellId: "parent-a", purpose: "Original A purpose" };
  parentB.livingContext = { cellId: "parent-b", purpose: "Original B purpose" };

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  console.assert(
    parentA.livingContext.purpose === "Original A purpose",
    "Parent A Living Context should not change"
  );
  console.assert(
    parentB.livingContext.purpose === "Original B purpose",
    "Parent B Living Context should not change"
  );
  
  console.log("✅ Parent Living Context not modified");
}

async function test13_ParentHasFusedIntoRelationship() {
  console.log("\n=== Test 13: Parent 有 fused-into relationship ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  const parentARelationship = parentA.relationships.find(
    r => r.type === "fused-into" && r.target === "child-fused"
  );
  const parentBRelationship = parentB.relationships.find(
    r => r.type === "fused-into" && r.target === "child-fused"
  );

  console.assert(parentARelationship, "Parent A should have fused-into relationship");
  console.assert(parentBRelationship, "Parent B should have fused-into relationship");
  
  console.log("✅ Parents have fused-into relationships");
}

async function test14_ChildHasFusedFromRelationship() {
  console.log("\n=== Test 14: Child 有 fused-from relationship ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  const child = result.child;

  const fusedFromA = child.relationships.find(
    r => r.type === "fused-from" && r.target === "parent-a"
  );
  const fusedFromB = child.relationships.find(
    r => r.type === "fused-from" && r.target === "parent-b"
  );

  console.assert(fusedFromA, "Child should have fused-from relationship to parent-a");
  console.assert(fusedFromB, "Child should have fused-from relationship to parent-b");
  
  console.log("✅ Child has fused-from relationships");
}

async function test15_ApplicationFailureCompleteFalse() {
  console.log("\n=== Test 15: Application failure 時 complete false ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    dnaFusionService: {
      createPlan: async () => ({
        type: "dna-fusion",
        parentCellIds: [parentA.id, parentB.id],
        childCellId: "child-fused",
        fusedVector: parentA.dnaVector,
        role: "Unified Role",
      }),
      applyPlan: async () => {
        throw new Error("Apply DNA failed");
      },
    },
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  console.assert(result.success === false, "Success should be false");
  console.assert(result.complete === false, "Complete should be false");
  console.assert(result.errors.length > 0, "Errors should be recorded");
  
  console.log("✅ Application failure sets complete to false");
}

async function test16_ApplicationFailureChildNotDeleted() {
  console.log("\n=== Test 16: Application failure 時 Child 不被刪除 ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    dnaFusionService: {
      createPlan: async () => ({
        type: "dna-fusion",
        parentCellIds: [parentA.id, parentB.id],
        childCellId: "child-fused",
        fusedVector: parentA.dnaVector,
        role: "Unified Role",
      }),
      applyPlan: async () => {
        throw new Error("Apply DNA failed");
      },
    },
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  console.assert(result.child !== null, "Child should exist");
  console.assert(result.child.id === "child-fused", "Child ID should match");
  console.assert(engine.createdCells.length === 1, "Child should not be deleted");
  
  console.log("✅ Application failure does not delete Child");
}

async function test17_ErrorsIncludeStage() {
  console.log("\n=== Test 17: errors 包含 stage ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    dnaFusionService: {
      createPlan: async () => ({
        type: "dna-fusion",
        parentCellIds: [parentA.id, parentB.id],
        childCellId: "child-fused",
        fusedVector: parentA.dnaVector,
        role: "Unified Role",
      }),
      applyPlan: async () => {
        throw new Error("Apply DNA failed");
      },
    },
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  console.assert(result.errors.length > 0, "Errors should exist");
  console.assert(result.errors[0].stage === "apply-dna", "Error stage should be apply-dna");
  console.assert(
    result.errors[0].message.includes("Apply DNA failed"),
    "Error message should match"
  );
  
  console.log("✅ Errors include stage information");
}

async function test18_ParentAndChildHaveIncompleteHistory() {
  console.log("\n=== Test 18: Parent 與 Child 有 incomplete history ===\n");

  const engine = new FakeEngine();
  const parentA = new FakeCell("parent-a");
  const parentB = new FakeCell("parent-b");

  const service = createCellFusionService({
    dnaFusionService: {
      createPlan: async () => ({
        type: "dna-fusion",
        parentCellIds: [parentA.id, parentB.id],
        childCellId: "child-fused",
        fusedVector: parentA.dnaVector,
        role: "Unified Role",
      }),
      applyPlan: async () => {
        throw new Error("Apply DNA failed");
      },
    },
    livingContextFusionServiceFactory: (requesterCell) => {
      return new FakeLivingContextFusionService({ requesterCell });
    },
  });

  const result = await service.fuse({
    engine,
    parentCells: [parentA, parentB],
    childId: "child-fused",
  });

  const child = result.child;

  console.assert(parentA.history.length > 0, "Parent A should have history");
  console.assert(parentB.history.length > 0, "Parent B should have history");
  console.assert(child.history.length > 0, "Child should have history");

  const parentAHasIncomplete = parentA.history.some(h => h.includes("Incomplete Fusion"));
  const parentBHasIncomplete = parentB.history.some(h => h.includes("Incomplete Fusion"));
  const childHasIncomplete = child.history.some(h => h.includes("Incomplete Fusion"));

  console.assert(parentAHasIncomplete, "Parent A should have incomplete history");
  console.assert(parentBHasIncomplete, "Parent B should have incomplete history");
  console.assert(childHasIncomplete, "Child should have incomplete history");
  
  console.log("✅ Parent and Child have incomplete history");
}

// ===== 執行所有測試 =====

async function runAllTests() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  CellFusionService Test Suite          ║");
  console.log("╚══════════════════════════════════════════╝");

  try {
    await test01_DNAPlanningBeforeCreateCell();
    await test02_LivingContextPlanningBeforeCreateCell();
    await test03_DNAPlanningFailureNoChild();
    await test04_LivingContextPlanningFailureNoChild();
    await test05_ChildAlreadyExistsFails();
    await test06_ChildSuccessfullyCreated();
    await test07_ApplyFusionPlanByDNACalled();
    await test08_FusedLivingContextWritten();
    await test09_ChildResponsibilitiesReplaced();
    await test10_FusedMemorySeedWritten();
    await test11_ParentMemoryNotModified();
    await test12_ParentLivingContextNotModified();
    await test13_ParentHasFusedIntoRelationship();
    await test14_ChildHasFusedFromRelationship();
    await test15_ApplicationFailureCompleteFalse();
    await test16_ApplicationFailureChildNotDeleted();
    await test17_ErrorsIncludeStage();
    await test18_ParentAndChildHaveIncompleteHistory();

    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║  ✅ All Tests Passed                    ║");
    console.log("╚══════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
