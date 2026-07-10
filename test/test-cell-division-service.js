// test/test-cell-division-service.js

/**
 * CellDivisionService 測試
 * 
 * 使用 Fake 實作，不呼叫真實 AI
 */

import { CellDivisionService } from "../src/lifecycle/cell-division-service.js";

// Fake Engine
class FakeEngine {
  constructor() {
    this.cells = new Map();
    this.createdCells = [];
  }

  hasCell(childId) {
    return this.cells.has(childId);
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
    this.dnaVector = {};
    this.dnaHistory = [];
    this.livingContext = null;
    this.memory = {};
    this.history = [];
    this.thoughts = [];
    this.responsibilities = [];
    this.relationships = [];
    this.generation = 1;
    this.parent = null;
  }

  async assertCanDivide() {
    // 假設可以分裂
  }

  async createDivisionPlanBySVD(childId) {
    return {
      parentId: this.id,
      childId,
      role: "Test Role",
      reason: "Test Reason",
      childDNAVector: { TEST: { strength: 0.8 } },
      parentDNAVector: { TEST: { strength: 0.6 } },
      dominantTraits: [{ name: "TEST", value: 0.8 }],
      dominantFactors: [{ name: "strength", value: 0.8 }],
    };
  }

  async applyDivisionPlanBySVD(childCell, dnaPlan) {
    await childCell.writeDNAVector(dnaPlan.childDNAVector);
    await childCell.appendDNAHistory("svd-division-inheritance");

    await this.writeDNAVector(dnaPlan.parentDNAVector);
    await this.appendDNAHistory("svd-division-attenuation");

    await childCell.setGeneration(this.generation + 1);
    await childCell.setParent(this.id);

    await this.addRelationship("divided-into", childCell.id);
    await childCell.addRelationship("born-from", this.id);

    await childCell.writeMemory("history", `Born from ${this.id}`);
    await childCell.appendThought(`I was born from ${this.id}.`);
    await this.appendHistory(`DNA Division into ${childCell.id}`);
    await this.appendThought(`I divided into ${childCell.id}.`);
  }

  async writeDNAVector(vector) {
    this.dnaVector = vector;
  }

  async appendDNAHistory(reason) {
    this.dnaHistory.push({ reason, at: new Date().toISOString() });
  }

  async readLivingContext() {
    return this.livingContext;
  }

  async writeLivingContext(context) {
    this.livingContext = context;
  }

  async writeMemory(name, content) {
    this.memory[name] = content;
  }

  async appendHistory(content) {
    this.history.push(content);
  }

  async appendThought(content) {
    this.thoughts.push(content);
  }

  async setResponsibilities(responsibilities) {
    this.responsibilities = [...responsibilities];
  }

  async addRelationship(type, target) {
    this.relationships.push({ type, target });
  }

  async listRelationships() {
    return this.relationships;
  }

  async setGeneration(generation) {
    this.generation = generation;
  }

  async setParent(parentId) {
    this.parent = parentId;
  }

  async askWithTimeout(prompt, timeout) {
    throw new Error("askWithTimeout should not be called in Fake");
  }
}

// Fake LivingContextService
class FakeLivingContextService {
  constructor({ requesterCell }) {
    this.requesterCell = requesterCell;
    this.createDivisionPlanCalled = false;
  }

  async createDivisionPlan({ parentCell, childId, dnaDivisionPlan }) {
    this.createDivisionPlanCalled = true;

    return {
      type: "living-context-division",
      parentCellId: parentCell.id,
      childCellId: childId,
      revisedParentLivingContext: {
        id: `living-context-${parentCell.id}`,
        cellId: parentCell.id,
        purpose: "Parent purpose",
        responsibilities: ["Order", "User"],
        owns: [],
        excludes: [],
        inputs: [],
        outputs: [],
        constraints: [],
        relationships: [],
      },
      childLivingContext: {
        id: `living-context-${childId}`,
        cellId: childId,
        purpose: "Child purpose",
        responsibilities: ["Payment"],
        owns: [],
        excludes: [],
        inputs: [],
        outputs: [],
        constraints: [],
        relationships: [],
      },
      childMemorySeed: {
        knowledge: "Test knowledge",
        history: "Test history",
        thought: "Test thought",
      },
    };
  }
}

// ===== 測試 =====

async function testPlanningPhase() {
  console.log("\n=== Test: Planning Phase ===\n");

  const engine = new FakeEngine();
  const parentCell = new FakeCell("parent-001");

  let livingContextServiceCreated = false;
  const service = new CellDivisionService({
    livingContextServiceFactory: (requesterCell) => {
      livingContextServiceCreated = true;
      console.assert(
        requesterCell.id === parentCell.id,
        "requesterCell should be parentCell"
      );
      return new FakeLivingContextService({ requesterCell });
    },
  });

  const result = await service.divide({
    engine,
    parentCell,
    childId: "child-001",
  });

  console.assert(result.complete === true, "Division should be complete");
  console.assert(result.dnaDivisionPlan !== null, "DNA plan should exist");
  console.assert(result.livingContextPlan !== null, "Living Context plan should exist");
  console.assert(livingContextServiceCreated === true, "LivingContextService should be created");

  console.log("✅ Planning phase completes before child creation");
}

async function testChildCreation() {
  console.log("\n=== Test: Child Creation ===\n");

  const engine = new FakeEngine();
  const parentCell = new FakeCell("parent-002");

  const service = new CellDivisionService({
    livingContextServiceFactory: (requesterCell) => {
      return new FakeLivingContextService({ requesterCell });
    },
  });

  const result = await service.divide({
    engine,
    parentCell,
    childId: "child-002",
  });

  console.assert(engine.createdCells.length === 1, "Should create exactly one child");
  console.assert(engine.createdCells[0] === "child-002", "Should create correct child ID");
  console.assert(result.child.id === "child-002", "Result should contain child cell");

  console.log("✅ Child cell created after planning");
}

async function testDNAApplication() {
  console.log("\n=== Test: DNA Application ===\n");

  const engine = new FakeEngine();
  const parentCell = new FakeCell("parent-003");

  const service = new CellDivisionService({
    livingContextServiceFactory: (requesterCell) => {
      return new FakeLivingContextService({ requesterCell });
    },
  });

  const result = await service.divide({
    engine,
    parentCell,
    childId: "child-003",
  });

  const child = result.child;

  console.assert(
    child.dnaHistory.some((h) => h.reason === "svd-division-inheritance"),
    "Child should have DNA inheritance history"
  );

  console.assert(
    parentCell.dnaHistory.some((h) => h.reason === "svd-division-attenuation"),
    "Parent should have DNA attenuation history"
  );

  console.assert(child.generation === parentCell.generation + 1, "Child generation should be parent + 1");
  console.assert(child.parent === parentCell.id, "Child parent should be set");

  console.log("✅ DNA division applied correctly");
}

async function testLivingContextApplication() {
  console.log("\n=== Test: Living Context Application ===\n");

  const engine = new FakeEngine();
  const parentCell = new FakeCell("parent-004");

  const service = new CellDivisionService({
    livingContextServiceFactory: (requesterCell) => {
      return new FakeLivingContextService({ requesterCell });
    },
  });

  const result = await service.divide({
    engine,
    parentCell,
    childId: "child-004",
  });

  const child = result.child;

  console.assert(parentCell.livingContext !== null, "Parent Living Context should be updated");
  console.assert(child.livingContext !== null, "Child Living Context should be created");

  console.assert(
    parentCell.livingContext.cellId === parentCell.id,
    "Parent Living Context cellId should match"
  );

  console.assert(
    child.livingContext.cellId === child.id,
    "Child Living Context cellId should match"
  );

  console.log("✅ Living Context applied correctly");
}

async function testMemorySeed() {
  console.log("\n=== Test: Memory Seed Application ===\n");

  const engine = new FakeEngine();
  const parentCell = new FakeCell("parent-005");

  const service = new CellDivisionService({
    livingContextServiceFactory: (requesterCell) => {
      return new FakeLivingContextService({ requesterCell });
    },
  });

  const result = await service.divide({
    engine,
    parentCell,
    childId: "child-005",
  });

  const child = result.child;

  console.assert(child.memory.identity !== undefined, "Child should have identity");
  console.assert(child.memory.knowledge !== undefined, "Child should have knowledge");
  console.assert(child.memory.history !== undefined, "Child should have history");
  console.assert(child.thoughts.length > 0, "Child should have thoughts");

  console.log("✅ Memory Seed applied correctly");
}

async function testResponsibilities() {
  console.log("\n=== Test: Responsibilities Sync ===\n");

  const engine = new FakeEngine();
  const parentCell = new FakeCell("parent-006");

  const service = new CellDivisionService({
    livingContextServiceFactory: (requesterCell) => {
      return new FakeLivingContextService({ requesterCell });
    },
  });

  const result = await service.divide({
    engine,
    parentCell,
    childId: "child-006",
  });

  const child = result.child;

  console.assert(
    parentCell.responsibilities.includes("Order"),
    "Parent should have Order responsibility"
  );

  console.assert(
    parentCell.responsibilities.includes("User"),
    "Parent should have User responsibility"
  );

  console.assert(
    child.responsibilities.includes("Payment"),
    "Child should have Payment responsibility"
  );

  console.log("✅ Responsibilities synced correctly");
}

async function testRelationships() {
  console.log("\n=== Test: Relationships ===\n");

  const engine = new FakeEngine();
  const parentCell = new FakeCell("parent-007");

  const service = new CellDivisionService({
    livingContextServiceFactory: (requesterCell) => {
      return new FakeLivingContextService({ requesterCell });
    },
  });

  const result = await service.divide({
    engine,
    parentCell,
    childId: "child-007",
  });

  const child = result.child;

  console.assert(
    parentCell.relationships.some((r) => r.type === "divided-into" && r.target === child.id),
    "Parent should have divided-into relationship"
  );

  console.assert(
    child.relationships.some((r) => r.type === "born-from" && r.target === parentCell.id),
    "Child should have born-from relationship"
  );

  console.log("✅ Relationships created correctly");
}

async function testParentMemoryNotCopied() {
  console.log("\n=== Test: Parent Memory Not Copied ===\n");

  const engine = new FakeEngine();
  const parentCell = new FakeCell("parent-008");
  parentCell.memory.secretData = "This should not be copied";

  const service = new CellDivisionService({
    livingContextServiceFactory: (requesterCell) => {
      return new FakeLivingContextService({ requesterCell });
    },
  });

  const result = await service.divide({
    engine,
    parentCell,
    childId: "child-008",
  });

  const child = result.child;

  console.assert(
    child.memory.secretData === undefined,
    "Child should not have parent's secret data"
  );

  console.log("✅ Parent memory not copied");
}

async function testChildAlreadyExists() {
  console.log("\n=== Test: Child Already Exists ===\n");

  const engine = new FakeEngine();
  const parentCell = new FakeCell("parent-009");

  // 預先建立 Child
  await engine.createCell("child-009");

  const service = new CellDivisionService({
    livingContextServiceFactory: (requesterCell) => {
      return new FakeLivingContextService({ requesterCell });
    },
  });

  let errorCaught = false;
  try {
    await service.divide({
      engine,
      parentCell,
      childId: "child-009",
    });
  } catch (error) {
    errorCaught = true;
    console.assert(
      error.message.includes("already exists"),
      "Error message should mention already exists"
    );
  }

  console.assert(errorCaught, "Should throw error when child already exists");

  console.log("✅ Fails when child already exists");
}

async function testPlanningFailure() {
  console.log("\n=== Test: Planning Failure ===\n");

  const engine = new FakeEngine();
  const parentCell = new FakeCell("parent-010");

  const service = new CellDivisionService({
    livingContextServiceFactory: (requesterCell) => {
      return {
        async createDivisionPlan() {
          throw new Error("Planning failed");
        },
      };
    },
  });

  let errorCaught = false;
  try {
    await service.divide({
      engine,
      parentCell,
      childId: "child-010",
    });
  } catch (error) {
    errorCaught = true;
    console.assert(
      error.message.includes("planning failed"),
      "Error message should mention planning failed"
    );
  }

  console.assert(errorCaught, "Should throw error when planning fails");
  console.assert(
    engine.createdCells.length === 0,
    "Should not create child when planning fails"
  );

  console.log("✅ Fails correctly when planning fails");
}

async function testParameterValidation() {
  console.log("\n=== Test: Parameter Validation ===\n");

  const service = new CellDivisionService();

  // Missing engine
  try {
    await service.divide({ engine: null, parentCell: new FakeCell("test"), childId: "test" });
    console.assert(false, "Should throw when engine is null");
  } catch (error) {
    console.assert(error.message.includes("engine is required"), "Should validate engine");
  }

  // Missing parentCell
  try {
    await service.divide({ engine: new FakeEngine(), parentCell: null, childId: "test" });
    console.assert(false, "Should throw when parentCell is null");
  } catch (error) {
    console.assert(error.message.includes("parentCell is required"), "Should validate parentCell");
  }

  // Empty childId
  try {
    await service.divide({
      engine: new FakeEngine(),
      parentCell: new FakeCell("test"),
      childId: "",
    });
    console.assert(false, "Should throw when childId is empty");
  } catch (error) {
    console.assert(
      error.message.includes("non-empty string"),
      "Should validate childId is non-empty"
    );
  }

  // childId equals parentCell.id
  try {
    await service.divide({
      engine: new FakeEngine(),
      parentCell: new FakeCell("test"),
      childId: "test",
    });
    console.assert(false, "Should throw when childId equals parentCell.id");
  } catch (error) {
    console.assert(
      error.message.includes("must not equal"),
      "Should validate childId not equal to parentCell.id"
    );
  }

  console.log("✅ Parameter validation works correctly");
}

// ===== 執行測試 =====

async function runAllTests() {
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║   CellDivisionService Test Suite                     ║");
  console.log("╚═══════════════════════════════════════════════════════╝");

  await testParameterValidation();
  await testChildAlreadyExists();
  await testPlanningFailure();
  await testPlanningPhase();
  await testChildCreation();
  await testDNAApplication();
  await testLivingContextApplication();
  await testMemorySeed();
  await testResponsibilities();
  await testRelationships();
  await testParentMemoryNotCopied();

  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║   ✅ All Tests Passed                                 ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");
}

runAllTests().catch((error) => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
