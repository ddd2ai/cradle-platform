/**
 * test-living-context-fusion-service.js
 * 測試 LivingContextFusionService 的 Fusion Plan 建立流程
 */

import { LivingContextFusionService } from "../src/living-context/living-context-fusion-service.js";

// ===========================
// Fake Objects
// ===========================

class FakeParentCell {
  constructor(id) {
    this.id = id;
  }
}

class FakeRequesterCell {
  constructor(id, responseProvider) {
    this.id = id;
    this.responseProvider = responseProvider;
    this.askWithTimeoutCalls = [];
  }

  async askWithTimeout(prompt, timeout) {
    this.askWithTimeoutCalls.push({ prompt, timeout });
    return this.responseProvider();
  }
}

class FakeSourceMaterialService {
  constructor() {
    this.buildCellSourceMaterialCalls = [];
    this.materials = new Map();
  }

  registerMaterial(cellId, material) {
    this.materials.set(cellId, material);
  }

  async buildCellSourceMaterial(cell) {
    this.buildCellSourceMaterialCalls.push(cell.id);

    const material = this.materials.get(cell.id);
    if (!material) {
      throw new Error(`No material registered for ${cell.id}`);
    }

    return material;
  }
}

// ===========================
// Test Helpers
// ===========================

function createValidFusionPlanResponse(childId) {
  return {
    text: JSON.stringify({
      type: "wrong-type",
      parentCellIds: ["wrong-parent"],
      childCellId: "wrong-child",

      fusedLivingContext: {
        purpose: "Unified payment lifecycle",
        responsibilities: [
          "Handle payments",
          "Handle settlement"
        ],
        owns: ["Payment"],
        excludes: [],
        inputs: [],
        outputs: [],
        constraints: [],
        relationships: []
      },

      fusedMemorySeed: {
        knowledge: "Unified payment knowledge",
        history: "Created from fusion",
        thought: "I combine payment capabilities"
      },

      capabilityResolutions: [],
      knowledgeConflicts: [],

      productionPlan: [
        {
          type: "code",
          title: "Unified Payment Service",
          goal: "Create unified payment service",
          constraints: [],
          sourceArtifacts: [
            {
              cellId: "cell-a",
              artifactId: "artifact-a"
            },
            {
              cellId: "cell-b",
              artifactId: "artifact-b"
            }
          ],
          sourceUsage: "reference"
        }
      ],

      assumptions: []
    })
  };
}

function createMarkdownFencedResponse() {
  const jsonContent = JSON.stringify({
    type: "living-context-fusion",
    parentCellIds: ["cell-a", "cell-b"],
    childCellId: "cell-fused",

    fusedLivingContext: {
      purpose: "Test purpose",
      responsibilities: ["Test"]
    },

    fusedMemorySeed: {
      knowledge: "Test knowledge",
      history: "",
      thought: ""
    },

    capabilityResolutions: [],
    knowledgeConflicts: [],
    productionPlan: [],
    assumptions: []
  }, null, 2);

  return {
    text: "```json\n" + jsonContent + "\n```"
  };
}

function setupService() {
  const parentA = new FakeParentCell("cell-a");
  const parentB = new FakeParentCell("cell-b");

  const sourceMaterialService = new FakeSourceMaterialService();

  sourceMaterialService.registerMaterial("cell-a", {
    cellId: "cell-a",
    livingContext: {
      purpose: "Handle payments",
      responsibilities: ["Payment"]
    },
    distilledMemory: {
      knowledge: "Payment knowledge",
      history: "",
      thought: ""
    },
    artifactCatalog: [
      {
        artifactId: "artifact-a",
        type: "code",
        title: "Payment Service"
      }
    ]
  });

  sourceMaterialService.registerMaterial("cell-b", {
    cellId: "cell-b",
    livingContext: {
      purpose: "Handle settlement",
      responsibilities: ["Settlement"]
    },
    distilledMemory: {
      knowledge: "Settlement knowledge",
      history: "",
      thought: ""
    },
    artifactCatalog: [
      {
        artifactId: "artifact-b",
        type: "code",
        title: "Settlement Service"
      }
    ]
  });

  return {
    parentA,
    parentB,
    sourceMaterialService
  };
}

// ===========================
// Tests
// ===========================

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log(
    "Testing Living Context Fusion Service...\n"
  );

  for (
    let index = 0;
    index < tests.length;
    index++
  ) {
    const {
      name,
      fn,
    } = tests[index];

    console.log(
      `Test ${index + 1}: ${name}`
    );

    try {
      await fn();

      console.log(
        "  ✅ PASS\n"
      );

      passed++;
    } catch (error) {
      console.log(
        `  ❌ FAIL: ${error.message}\n`
      );

      if (error.cause) {
        console.log(
          `  Cause: ${error.cause.message}\n`
        );
      }

      failed++;
    }
  }

  console.log(
    "=".repeat(50)
  );

  console.log(
    `Total: ${tests.length}`
  );

  console.log(
    `Passed: ${passed}`
  );

  console.log(
    `Failed: ${failed}`
  );

  console.log(
    "=".repeat(50)
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

// ===========================
// Test Cases
// ===========================

test("buildCellSourceMaterial() called once for each parent", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  if (sourceMaterialService.buildCellSourceMaterialCalls.length !== 2) {
    throw new Error(
      `Expected 2 calls, got ${sourceMaterialService.buildCellSourceMaterialCalls.length}`
    );
  }

  if (!sourceMaterialService.buildCellSourceMaterialCalls.includes("cell-a")) {
    throw new Error("cell-a not in buildCellSourceMaterial calls");
  }

  if (!sourceMaterialService.buildCellSourceMaterialCalls.includes("cell-b")) {
    throw new Error("cell-b not in buildCellSourceMaterial calls");
  }
});

test("askWithTimeout() called exactly once", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  if (requester.askWithTimeoutCalls.length !== 1) {
    throw new Error(
      `Expected 1 call, got ${requester.askWithTimeoutCalls.length}`
    );
  }
});

test("timeout is 3600000", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  const call = requester.askWithTimeoutCalls[0];
  if (call.timeout !== 3600000) {
    throw new Error(`Expected timeout 3600000, got ${call.timeout}`);
  }
});

test("Prompt contains cell-a", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  const prompt = requester.askWithTimeoutCalls[0].prompt;
  if (!prompt.includes("cell-a")) {
    throw new Error("Prompt does not contain cell-a");
  }
});

test("Prompt contains cell-b", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  const prompt = requester.askWithTimeoutCalls[0].prompt;
  if (!prompt.includes("cell-b")) {
    throw new Error("Prompt does not contain cell-b");
  }
});

test("Prompt contains 'Handle payments'", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  const prompt = requester.askWithTimeoutCalls[0].prompt;
  if (!prompt.includes("Handle payments")) {
    throw new Error("Prompt does not contain 'Handle payments'");
  }
});

test("Prompt contains artifact-a", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  const prompt = requester.askWithTimeoutCalls[0].prompt;
  if (!prompt.includes("artifact-a")) {
    throw new Error("Prompt does not contain artifact-a");
  }
});

test("Prompt declares schema enum constraints", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();
  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );
  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService,
  });

  await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {},
  });

  const prompt = requester.askWithTimeoutCalls[0].prompt;
  if (!prompt.includes("inherit, synthesize, replace, discard, contract")) {
    throw new Error("Prompt does not declare capability strategy values");
  }
  if (!prompt.includes("reference, behavior-reference, contract-reference")) {
    throw new Error("Prompt does not declare source usage values");
  }
});

test("type is forced to 'living-context-fusion'", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  const plan = await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  if (plan.type !== "living-context-fusion") {
    throw new Error(`Expected type 'living-context-fusion', got '${plan.type}'`);
  }
});

test("parentCellIds is overwritten to actual parent IDs", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  const plan = await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  if (!Array.isArray(plan.parentCellIds)) {
    throw new Error("parentCellIds is not an array");
  }

  if (plan.parentCellIds.length !== 2) {
    throw new Error(`Expected 2 parent IDs, got ${plan.parentCellIds.length}`);
  }

  if (!plan.parentCellIds.includes("cell-a")) {
    throw new Error("parentCellIds does not include cell-a");
  }

  if (!plan.parentCellIds.includes("cell-b")) {
    throw new Error("parentCellIds does not include cell-b");
  }
});

test("childCellId is overwritten to provided child ID", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  const plan = await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  if (plan.childCellId !== "cell-fused") {
    throw new Error(`Expected childCellId 'cell-fused', got '${plan.childCellId}'`);
  }
});

test("Markdown code fence JSON can be parsed", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", createMarkdownFencedResponse);

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  const plan = await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {}
  });

  if (!plan.fusedLivingContext) {
    throw new Error("Plan does not have fusedLivingContext");
  }

  if (plan.fusedLivingContext.purpose !== "Test purpose") {
    throw new Error("Failed to parse markdown fenced JSON");
  }
});

test("Cradle assistant answer envelope can be parsed", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();
  const response = createValidFusionPlanResponse("cell-fused");
  const requester = new FakeRequesterCell("cell-a", () => ({
    answer: response.text,
  }));
  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService,
  });

  const plan = await service.createFusionPlan({
    parentCells: [parentA, parentB],
    childId: "cell-fused",
    dnaFusionPlan: {},
  });

  if (plan.fusedLivingContext.purpose !== "Unified payment lifecycle") {
    throw new Error("answer envelope was not unwrapped");
  }
});

test("Non-JSON response throws error with 'failed to parse fusion plan'", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () => ({
    text: "This is not JSON"
  }));

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  try {
    await service.createFusionPlan({
      parentCells: [parentA, parentB],
      childId: "cell-fused",
      dnaFusionPlan: {}
    });
    throw new Error("Should have thrown");
  } catch (error) {
    if (!error.message.includes("failed to parse fusion plan")) {
      throw new Error(
        `Expected error to include 'failed to parse fusion plan', got: ${error.message}`
      );
    }
  }
});

test("Unknown artifact throws error with 'unknown artifact'", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () => ({
    text: JSON.stringify({
      type: "living-context-fusion",
      parentCellIds: ["cell-a", "cell-b"],
      childCellId: "cell-fused",

      fusedLivingContext: {
        purpose: "Test",
        responsibilities: ["Test"]
      },

      fusedMemorySeed: {
        knowledge: "",
        history: "",
        thought: ""
      },

      capabilityResolutions: [],
      knowledgeConflicts: [],

      productionPlan: [
        {
          type: "code",
          title: "Test",
          goal: "Test",
          constraints: [],
          sourceArtifacts: [
            {
              cellId: "cell-a",
              artifactId: "artifact-unknown"
            }
          ]
        }
      ],

      assumptions: []
    })
  }));

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  try {
    await service.createFusionPlan({
      parentCells: [parentA, parentB],
      childId: "cell-fused",
      dnaFusionPlan: {}
    });
    throw new Error("Should have thrown");
  } catch (error) {
    if (!error.message.includes("unknown artifact")) {
      throw new Error(
        `Expected error to include 'unknown artifact', got: ${error.message}`
      );
    }
  }
});

test("Empty fusedLivingContext fails validation", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const requester = new FakeRequesterCell("cell-a", () => ({
    text: JSON.stringify({
      type: "living-context-fusion",
      parentCellIds: ["cell-a", "cell-b"],
      childCellId: "cell-fused",

      fusedLivingContext: {
        purpose: "",
        responsibilities: [],
        owns: [],
        outputs: []
      },

      fusedMemorySeed: {
        knowledge: "",
        history: "",
        thought: ""
      },

      capabilityResolutions: [],
      knowledgeConflicts: [],
      productionPlan: [],
      assumptions: []
    })
  }));

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  try {
    await service.createFusionPlan({
      parentCells: [parentA, parentB],
      childId: "cell-fused",
      dnaFusionPlan: {}
    });
    throw new Error("Should have thrown");
  } catch (error) {
    if (!error.message.includes("fusedLivingContext")) {
      throw new Error(
        `Expected error about fusedLivingContext, got: ${error.message}`
      );
    }
  }
});

test("Source Material failure preserves cause", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  // Remove material for cell-b to cause failure
  sourceMaterialService.materials.delete("cell-b");

  const requester = new FakeRequesterCell("cell-a", () =>
    createValidFusionPlanResponse("cell-fused")
  );

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  try {
    await service.createFusionPlan({
      parentCells: [parentA, parentB],
      childId: "cell-fused",
      dnaFusionPlan: {}
    });
    throw new Error("Should have thrown");
  } catch (error) {
    if (!error.cause) {
      throw new Error("Error should have cause property");
    }
  }
});

test("AI request failure preserves cause", async () => {
  const { parentA, parentB, sourceMaterialService } = setupService();

  const originalError = new Error("AI service unavailable");

  const requester = new FakeRequesterCell("cell-a", () => {
    throw originalError;
  });

  const service = new LivingContextFusionService({
    requesterCell: requester,
    sourceMaterialService
  });

  try {
    await service.createFusionPlan({
      parentCells: [parentA, parentB],
      childId: "cell-fused",
      dnaFusionPlan: {}
    });
    throw new Error("Should have thrown");
  } catch (error) {
    if (!error.cause) {
      throw new Error("Error should have cause property");
    }
    if (error.cause !== originalError) {
      throw new Error("Cause should be the original error");
    }
  }
});

// ===========================
// Run Tests
// ===========================

runTests();
