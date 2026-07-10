/**
 * test-division-plan-schema.js
 * 
 * 測試 Division Plan Schema 的 normalize 與 validate 功能
 */

import { createDivisionPlan, normalizeDivisionPlan, validateDivisionPlan } from '../src/living-context/division-plan-schema.js';

console.log('=== Division Plan Schema Tests ===\n');

let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Test 1: 合法 Plan 通過驗證
test('Valid plan passes validation', () => {
  const plan = {
    type: "living-context-division",
    parentCellId: "cell-parent",
    childCellId: "cell-child",
    revisedParentLivingContext: {
      purpose: "Handle orders",
      responsibilities: ["Order"],
      owns: ["Order"],
      excludes: [],
      inputs: [],
      outputs: [],
      constraints: [],
      relationships: []
    },
    childLivingContext: {
      purpose: "Handle payments",
      responsibilities: ["Payment"],
      owns: ["Payment"],
      excludes: [],
      inputs: [],
      outputs: [],
      constraints: [],
      relationships: []
    },
    childMemorySeed: {
      knowledge: "Payment knowledge",
      history: "Payment history",
      thought: "Payment thought"
    },
    productionPlan: [],
    sharedContracts: [],
    assumptions: []
  };

  const result = validateDivisionPlan(plan);
  assert(result.valid, `Validation should pass, got errors: ${result.errors.join(', ')}`);
  assert(result.errors.length === 0, 'Should have no errors');
});

// Test 2: normalize 不修改原始 input
test('Normalize does not modify original input', () => {
  const original = {
    parentCellId: " parent ",
    childCellId: " child ",
    revisedParentLivingContext: {
      purpose: " purpose ",
      responsibilities: [" resp1 ", " resp2 "]
    },
    childLivingContext: {
      purpose: " child purpose "
    },
    childMemorySeed: {
      knowledge: " knowledge "
    }
  };

  const originalCopy = JSON.parse(JSON.stringify(original));
  const normalized = normalizeDivisionPlan(original);

  assertEquals(original, originalCopy, 'Original should not be modified');
  assert(normalized.parentCellId === "parent", 'Normalized should trim strings');
});

// Test 3: trim 字串
test('Normalize trims strings', () => {
  const plan = {
    parentCellId: " parent ",
    childCellId: " child ",
    revisedParentLivingContext: {
      purpose: " purpose "
    },
    childLivingContext: {
      purpose: " child purpose "
    }
  };

  const normalized = normalizeDivisionPlan(plan);
  assert(normalized.parentCellId === "parent", 'Should trim parentCellId');
  assert(normalized.childCellId === "child", 'Should trim childCellId');
});

// Test 4: 字串陣列去空白、去重
test('Normalize removes empty strings and duplicates from arrays', () => {
  const plan = {
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {
      responsibilities: [" resp1 ", " resp1 ", " resp2 ", "", "  "]
    },
    childLivingContext: {
      purpose: "child"
    }
  };

  const normalized = normalizeDivisionPlan(plan);
  assertEquals(
    normalized.revisedParentLivingContext.responsibilities,
    ["resp1", "resp2"],
    'Should remove empty strings and duplicates'
  );
});

// Test 5: relationship 去重
test('Normalize removes duplicate relationships', () => {
  const plan = {
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {
      relationships: [
        { type: "uses", target: "service-a", description: "First" },
        { type: "uses", target: "service-a", description: "Second" },
        { type: "uses", target: "service-b" }
      ]
    },
    childLivingContext: {
      purpose: "child"
    }
  };

  const normalized = normalizeDivisionPlan(plan);
  assert(
    normalized.revisedParentLivingContext.relationships.length === 2,
    'Should remove duplicate relationships based on type + target'
  );
});

// Test 6: productionPlan sourceArtifactIds 去重
test('Normalize removes duplicate sourceArtifactIds', () => {
  const plan = {
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    },
    productionPlan: [
      {
        type: "code",
        title: "Service",
        goal: "Create service",
        sourceArtifactIds: [" artifact-1 ", " artifact-1 ", " artifact-2 ", "", "  "]
      }
    ]
  };

  const normalized = normalizeDivisionPlan(plan);
  assertEquals(
    normalized.productionPlan[0].sourceArtifactIds,
    ["artifact-1", "artifact-2"],
    'Should remove empty and duplicate artifact IDs'
  );
});

// Test 7: 缺少 parentCellId 失敗
test('Validation fails when parentCellId is missing', () => {
  const plan = {
    type: "living-context-division",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    },
    childMemorySeed: {}
  };

  const result = validateDivisionPlan(plan);
  assert(!result.valid, 'Should fail validation');
  assert(
    result.errors.some(e => e.includes('parentCellId')),
    'Should have parentCellId error'
  );
});

// Test 8: 缺少 childCellId 失敗
test('Validation fails when childCellId is missing', () => {
  const plan = {
    type: "living-context-division",
    parentCellId: "parent",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    },
    childMemorySeed: {}
  };

  const result = validateDivisionPlan(plan);
  assert(!result.valid, 'Should fail validation');
  assert(
    result.errors.some(e => e.includes('childCellId')),
    'Should have childCellId error'
  );
});

// Test 9: Parent 與 Child ID 相同失敗
test('Validation fails when parentCellId equals childCellId', () => {
  const plan = {
    type: "living-context-division",
    parentCellId: "same-id",
    childCellId: "same-id",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    },
    childMemorySeed: {}
  };

  const result = validateDivisionPlan(plan);
  assert(!result.valid, 'Should fail validation');
  assert(
    result.errors.some(e => e.includes('must not equal')),
    'Should have error about equal IDs'
  );
});

// Test 10: Child Living Context 完全空白失敗
test('Validation fails when childLivingContext is completely empty', () => {
  const plan = {
    type: "living-context-division",
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "",
      responsibilities: [],
      owns: [],
      outputs: []
    },
    childMemorySeed: {}
  };

  const result = validateDivisionPlan(plan);
  assert(!result.valid, 'Should fail validation');
  assert(
    result.errors.some(e => e.includes('must have at least one')),
    'Should have error about empty child context'
  );
});

// Test 11: productionPlan 可以是空陣列
test('ProductionPlan can be empty array', () => {
  const plan = {
    type: "living-context-division",
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child purpose"
    },
    childMemorySeed: {
      knowledge: "",
      history: "",
      thought: ""
    },
    productionPlan: [],
    sharedContracts: [],
    assumptions: []
  };

  const result = validateDivisionPlan(plan);
  assert(result.valid, `Should pass validation, got errors: ${result.errors.join(', ')}`);
});

// Test 12: production item 缺少 goal 失敗
test('Validation fails when production item missing goal', () => {
  const plan = {
    type: "living-context-division",
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    },
    childMemorySeed: {},
    productionPlan: [
      {
        type: "code",
        title: "Service"
        // missing goal
      }
    ]
  };

  const result = validateDivisionPlan(plan);
  assert(!result.valid, 'Should fail validation');
  assert(
    result.errors.some(e => e.includes('goal')),
    'Should have error about missing goal'
  );
});

// Test 13: 非法 sourceUsage 失敗
test('Validation fails for invalid sourceUsage', () => {
  const plan = {
    type: "living-context-division",
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    },
    childMemorySeed: {},
    productionPlan: [
      {
        type: "code",
        title: "Service",
        goal: "Create service",
        constraints: [],
        sourceArtifactIds: [],
        sourceUsage: "invalid-usage"
      }
    ]
  };

  const result = validateDivisionPlan(plan);
  assert(!result.valid, 'Should fail validation');
  assert(
    result.errors.some(e => e.includes('sourceUsage')),
    'Should have error about invalid sourceUsage'
  );
});

// Test 14: shared contract owner 不屬於 Parent 或 Child 時失敗
test('Validation fails when contract owner is neither parent nor child', () => {
  const plan = {
    type: "living-context-division",
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    },
    childMemorySeed: {},
    sharedContracts: [
      {
        name: "Contract",
        ownerCellId: "other-cell",
        consumerCellIds: [],
        description: ""
      }
    ]
  };

  const result = validateDivisionPlan(plan);
  assert(!result.valid, 'Should fail validation');
  assert(
    result.errors.some(e => e.includes('ownerCellId')),
    'Should have error about invalid ownerCellId'
  );
});

// Test 15: childMemorySeed 缺少時 normalize 會補空字串
test('Normalize adds empty childMemorySeed when missing', () => {
  const plan = {
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    }
    // childMemorySeed missing
  };

  const normalized = normalizeDivisionPlan(plan);
  assert(normalized.childMemorySeed, 'Should have childMemorySeed');
  assert(normalized.childMemorySeed.knowledge === "", 'Knowledge should be empty string');
  assert(normalized.childMemorySeed.history === "", 'History should be empty string');
  assert(normalized.childMemorySeed.thought === "", 'Thought should be empty string');
});

// Test 16: productionPlan 過濾掉缺少必要欄位的項目
test('Normalize filters out production items missing required fields', () => {
  const plan = {
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    },
    productionPlan: [
      {
        type: "code",
        title: "Valid",
        goal: "Create service"
      },
      {
        type: "code",
        title: "Invalid"
        // missing goal
      },
      {
        type: "code",
        goal: "Invalid"
        // missing title
      }
    ]
  };

  const normalized = normalizeDivisionPlan(plan);
  assert(normalized.productionPlan.length === 1, 'Should only keep valid items');
  assert(normalized.productionPlan[0].title === "Valid", 'Should keep the valid item');
});

// Test 17: createdAt 缺少時補目前 ISO timestamp
test('Normalize adds createdAt timestamp when missing', () => {
  const plan = {
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    }
  };

  const normalized = normalizeDivisionPlan(plan);
  assert(normalized.createdAt, 'Should have createdAt');
  assert(typeof normalized.createdAt === 'string', 'createdAt should be string');
  // 驗證是 ISO 8601 格式
  assert(!isNaN(Date.parse(normalized.createdAt)), 'createdAt should be valid ISO timestamp');
});

// Test 18: type 固定為 living-context-division
test('Normalize forces type to living-context-division', () => {
  const plan = {
    type: "wrong-type",
    parentCellId: "parent",
    childCellId: "child",
    revisedParentLivingContext: {},
    childLivingContext: {
      purpose: "child"
    }
  };

  const normalized = normalizeDivisionPlan(plan);
  assert(normalized.type === "living-context-division", 'Type should be forced to correct value');
});

// Summary
console.log(`\n=== Test Results ===`);
console.log(`Passed: ${passCount}/${testCount}`);
console.log(`Failed: ${testCount - passCount}/${testCount}`);

if (passCount === testCount) {
  console.log('\n✅ All tests passed!');
  process.exit(0);
} else {
  console.log('\n✗ Some tests failed');
  process.exit(1);
}
