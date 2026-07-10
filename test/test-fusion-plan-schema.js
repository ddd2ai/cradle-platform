/**
 * test-fusion-plan-schema.js
 * 
 * 測試 Fusion Plan Schema
 */

import {
  createFusionPlan,
  normalizeFusionPlan,
  validateFusionPlan
} from "../src/living-context/fusion-plan-schema.js";

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passCount++;
  } else {
    console.error(`✗ ${message}`);
    failCount++;
  }
}

function testCreateFusionPlan() {
  console.log("\n=== Test: createFusionPlan ===");

  const plan = createFusionPlan({
    parentCellIds: ["cell-a", "cell-b"],
    childCellId: "cell-fused",
    fusedLivingContext: {
      purpose: "Test purpose"
    }
  });

  assert(plan.type === "living-context-fusion", "type should be living-context-fusion");
  assert(plan.parentCellIds.length === 2, "should have 2 parent IDs");
  assert(plan.childCellId === "cell-fused", "childCellId should match");
  assert(typeof plan.createdAt === "string", "createdAt should be string");
}

function testNormalizeNotModifyInput() {
  console.log("\n=== Test: normalize does not modify input ===");

  const input = {
    parentCellIds: ["  cell-a  ", "cell-b", "cell-b"],
    childCellId: "  cell-fused  ",
    fusedLivingContext: {
      purpose: "  test  ",
      responsibilities: ["  a  ", "  b  ", "  a  "]
    }
  };

  const original = JSON.parse(JSON.stringify(input));
  const normalized = normalizeFusionPlan(input);

  assert(
    JSON.stringify(input) === JSON.stringify(original),
    "input should not be modified"
  );

  assert(normalized.parentCellIds[0] === "cell-a", "should trim parent IDs");
  assert(normalized.parentCellIds.length === 2, "should remove duplicate parent IDs");
  assert(normalized.childCellId === "cell-fused", "should trim child ID");
  assert(normalized.fusedLivingContext.purpose === "test", "should trim purpose");
  assert(normalized.fusedLivingContext.responsibilities.length === 2, "should remove duplicate responsibilities");
}

function testParentIdDeduplication() {
  console.log("\n=== Test: parent ID deduplication ===");

  const normalized = normalizeFusionPlan({
    parentCellIds: ["cell-a", "cell-b", "cell-a"],
    childCellId: "cell-fused"
  });

  assert(normalized.parentCellIds.length === 2, "should deduplicate parent IDs");
  assert(normalized.parentCellIds.includes("cell-a"), "should keep cell-a");
  assert(normalized.parentCellIds.includes("cell-b"), "should keep cell-b");
}

function testParentIdMinimum() {
  console.log("\n=== Test: parent ID minimum ===");

  const normalized = normalizeFusionPlan({
    parentCellIds: ["cell-a"],
    childCellId: "cell-fused"
  });

  assert(normalized.parentCellIds.length >= 1, "should keep at least 1 parent");
}

function testValidationSuccess() {
  console.log("\n=== Test: validation success ===");

  const plan = {
    type: "living-context-fusion",
    parentCellIds: ["cell-a", "cell-b"],
    childCellId: "cell-fused",
    fusedLivingContext: {
      purpose: "Test purpose",
      responsibilities: ["resp-1"],
      owns: [],
      excludes: [],
      inputs: [],
      outputs: [],
      constraints: [],
      relationships: []
    },
    fusedMemorySeed: {
      knowledge: "",
      history: "",
      thought: ""
    },
    capabilityResolutions: [],
    knowledgeConflicts: [],
    productionPlan: [],
    assumptions: [],
    createdAt: new Date().toISOString()
  };

  const validation = validateFusionPlan(plan);

  assert(validation.valid === true, "valid plan should pass validation");
  assert(validation.errors.length === 0, "valid plan should have no errors");
}

function testValidationLessThanTwoParents() {
  console.log("\n=== Test: validation fails with less than 2 parents ===");

  const plan = {
    type: "living-context-fusion",
    parentCellIds: ["cell-a"],
    childCellId: "cell-fused",
    fusedLivingContext: {
      purpose: "Test"
    },
    fusedMemorySeed: {},
    capabilityResolutions: [],
    knowledgeConflicts: [],
    productionPlan: []
  };

  const validation = validateFusionPlan(plan);

  assert(validation.valid === false, "plan with less than 2 parents should fail");
  assert(validation.errors.length > 0, "should have errors");
}

function testValidationChildInParents() {
  console.log("\n=== Test: validation fails when child ID in parent IDs ===");

  const plan = {
    type: "living-context-fusion",
    parentCellIds: ["cell-a", "cell-fused"],
    childCellId: "cell-fused",
    fusedLivingContext: {
      purpose: "Test"
    },
    fusedMemorySeed: {},
    capabilityResolutions: [],
    knowledgeConflicts: [],
    productionPlan: []
  };

  const validation = validateFusionPlan(plan);

  assert(validation.valid === false, "plan with child in parents should fail");
  assert(
    validation.errors.some(err => err.includes("must not contain childCellId")),
    "should have specific error message"
  );
}

function testValidationEmptyLivingContext() {
  console.log("\n=== Test: validation fails with empty living context ===");

  const plan = {
    type: "living-context-fusion",
    parentCellIds: ["cell-a", "cell-b"],
    childCellId: "cell-fused",
    fusedLivingContext: {},
    fusedMemorySeed: {},
    capabilityResolutions: [],
    knowledgeConflicts: [],
    productionPlan: []
  };

  const validation = validateFusionPlan(plan);

  assert(validation.valid === false, "empty living context should fail");
}

function testKnowledgeConflictStructure() {
  console.log("\n=== Test: knowledge conflict structure ===");

  const plan = {
    type: "living-context-fusion",
    parentCellIds: ["cell-a", "cell-b"],
    childCellId: "cell-fused",
    fusedLivingContext: {
      purpose: "Test"
    },
    fusedMemorySeed: {},
    capabilityResolutions: [],
    knowledgeConflicts: [
      {
        topic: "payment",
        views: [
          { cellId: "cell-a", view: "use stripe" },
          { cellId: "cell-b", view: "use paypal" }
        ],
        resolution: "use both"
      }
    ],
    productionPlan: []
  };

  const validation = validateFusionPlan(plan);

  assert(validation.valid === true, "valid knowledge conflict should pass");
}

function testCapabilityStrategyValidation() {
  console.log("\n=== Test: capability strategy validation ===");

  const validPlan = {
    type: "living-context-fusion",
    parentCellIds: ["cell-a", "cell-b"],
    childCellId: "cell-fused",
    fusedLivingContext: {
      purpose: "Test"
    },
    fusedMemorySeed: {},
    capabilityResolutions: [
      { capability: "payment", strategy: "inherit", resolution: "from cell-a" }
    ],
    knowledgeConflicts: [],
    productionPlan: []
  };

  const validValidation = validateFusionPlan(validPlan);
  assert(validValidation.valid === true, "valid strategy should pass");

  const invalidPlan = {
    ...validPlan,
    capabilityResolutions: [
      { capability: "payment", strategy: "unknown", resolution: "test" }
    ]
  };

  const invalidValidation = validateFusionPlan(invalidPlan);
  assert(invalidValidation.valid === false, "invalid strategy should fail");
}

function testSourceArtifactRefDeduplication() {
  console.log("\n=== Test: source artifact ref deduplication ===");

  const normalized = normalizeFusionPlan({
    parentCellIds: ["cell-a", "cell-b"],
    childCellId: "cell-fused",
    fusedLivingContext: {
      purpose: "Test"
    },
    productionPlan: [
      {
        type: "code",
        title: "test",
        goal: "test",
        sourceArtifacts: [
          { cellId: "cell-a", artifactId: "artifact-001" },
          { cellId: "cell-a", artifactId: "artifact-001" },
          { cellId: "cell-b", artifactId: "artifact-001" }
        ]
      }
    ]
  });

  const sourceArtifacts = normalized.productionPlan[0].sourceArtifacts;

  assert(sourceArtifacts.length === 2, "should deduplicate source artifacts");
}

function testProductionPlanCanBeEmpty() {
  console.log("\n=== Test: production plan can be empty ===");

  const plan = {
    type: "living-context-fusion",
    parentCellIds: ["cell-a", "cell-b"],
    childCellId: "cell-fused",
    fusedLivingContext: {
      purpose: "Test"
    },
    fusedMemorySeed: {},
    capabilityResolutions: [],
    knowledgeConflicts: [],
    productionPlan: []
  };

  const validation = validateFusionPlan(plan);

  assert(validation.valid === true, "empty production plan should pass");
}

// Run tests
console.log("Running Fusion Plan Schema Tests...");

testCreateFusionPlan();
testNormalizeNotModifyInput();
testParentIdDeduplication();
testParentIdMinimum();
testValidationSuccess();
testValidationLessThanTwoParents();
testValidationChildInParents();
testValidationEmptyLivingContext();
testKnowledgeConflictStructure();
testCapabilityStrategyValidation();
testSourceArtifactRefDeduplication();
testProductionPlanCanBeEmpty();

console.log(`\n=== Summary ===`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount > 0) {
  process.exit(1);
}
