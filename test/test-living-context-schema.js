/**
 * test-living-context-schema.js
 *
 * 測試 Living Context Schema 的建立、正規化與驗證
 */

import assert from "node:assert/strict";

import {
  createLivingContext,
  normalizeLivingContext,
  validateLivingContext,
} from "../src/living-context/living-context-schema.js";

console.log("Testing Living Context Schema...\n");

// Test 1: 建立預設 Living Context
{
  const context = createLivingContext({
    cellId: "cell-001",
  });

  assert.equal(context.id, "living-context-cell-001");
  assert.equal(context.cellId, "cell-001");
  assert.equal(context.purpose, "");

  assert.deepEqual(context.responsibilities, []);
  assert.deepEqual(context.owns, []);
  assert.deepEqual(context.excludes, []);
  assert.deepEqual(context.inputs, []);
  assert.deepEqual(context.outputs, []);
  assert.deepEqual(context.constraints, []);
  assert.deepEqual(context.relationships, []);

  assert.equal(typeof context.createdAt, "string");
  assert.equal(typeof context.updatedAt, "string");

  assert.doesNotThrow(() => new Date(context.createdAt).toISOString());
  assert.doesNotThrow(() => new Date(context.updatedAt).toISOString());

  console.log("✓ create default living context");
}

// Test 2: Normalize 清除空白與重複值
{
  const input = {
    cellId: "cell-001",
    purpose: "  Handle orders  ",
    responsibilities: [
      "Order",
      "Order",
      "",
      "  Payment  ",
    ],
    owns: [
      "  Database  ",
      "Database",
      "",
    ],
    excludes: [],
  };

  const normalized = normalizeLivingContext(input);

  assert.equal(normalized.cellId, "cell-001");
  assert.equal(normalized.purpose, "Handle orders");

  assert.deepEqual(
    normalized.responsibilities,
    ["Order", "Payment"]
  );

  assert.deepEqual(
    normalized.owns,
    ["Database"]
  );

  console.log("✓ normalize removes whitespace and duplicates");
}

// Test 3: Normalize 處理非陣列值
{
  const input = {
    cellId: "cell-001",
    purpose: "Test",
    responsibilities: "Order",
    owns: null,
    excludes: undefined,
    inputs: 123,
    outputs: {},
    constraints: false,
    relationships: "depends-on",
  };

  const normalized = normalizeLivingContext(input);

  assert.deepEqual(normalized.responsibilities, []);
  assert.deepEqual(normalized.owns, []);
  assert.deepEqual(normalized.excludes, []);
  assert.deepEqual(normalized.inputs, []);
  assert.deepEqual(normalized.outputs, []);
  assert.deepEqual(normalized.constraints, []);
  assert.deepEqual(normalized.relationships, []);

  console.log("✓ normalize handles non-array values");
}

// Test 4: Normalize 不應修改原始物件
{
  const input = {
    cellId: "cell-001",
    purpose: "  Test  ",
    responsibilities: [
      "Order",
      "Order",
    ],
    relationships: [
      {
        type: "  depends-on  ",
        target: "  cell-002  ",
      },
    ],
  };

  const original = structuredClone(input);

  normalizeLivingContext(input);

  assert.deepEqual(
    input,
    original,
    "normalizeLivingContext must not mutate input"
  );

  console.log("✓ normalize does not mutate input");
}

// Test 5: 缺少 cellId 時 createLivingContext 必須失敗
{
  assert.throws(
    () => createLivingContext({}),
    /cellId/i
  );

  assert.throws(
    () => createLivingContext({
      cellId: "   ",
    }),
    /cellId/i
  );

  console.log("✓ create rejects missing cellId");
}

// Test 6: Validate 拒絕 null
{
  const result = validateLivingContext(null);

  assert.equal(result.valid, false);
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.length > 0);

  assert.ok(
    result.errors.some((error) =>
      error.toLowerCase().includes("object")
    )
  );

  console.log("✓ validate rejects null");
}

// Test 7: Validate 拒絕錯誤的陣列欄位型別
{
  const arrayFields = [
    "responsibilities",
    "owns",
    "excludes",
    "inputs",
    "outputs",
    "constraints",
    "relationships",
  ];

  for (const field of arrayFields) {
    const context = {
      id: "living-context-cell-001",
      cellId: "cell-001",
      purpose: "Test",

      responsibilities: [],
      owns: [],
      excludes: [],
      inputs: [],
      outputs: [],
      constraints: [],
      relationships: [],

      [field]: "invalid",
    };

    const result = validateLivingContext(context);

    assert.equal(
      result.valid,
      false,
      `${field} should be rejected when it is not an array`
    );

    assert.ok(
      result.errors.some((error) =>
        error.includes(field)
      ),
      `validation error should mention ${field}`
    );
  }

  console.log("✓ validate rejects invalid array field types");
}

// Test 8: Validate 接受合法 Living Context
{
  const context = createLivingContext({
    cellId: "cell-001",
    purpose: "Handle orders",
    responsibilities: [
      "Order",
      "Payment",
    ],
    relationships: [
      {
        type: "depends-on",
        target: "cell-002",
      },
    ],
  });

  const result = validateLivingContext(context);

  assert.deepEqual(result, {
    valid: true,
    errors: [],
  });

  console.log("✓ validate accepts valid living context");
}

// Test 9: Validate 檢查 relationships 結構
{
  const context = {
    id: "living-context-cell-001",
    cellId: "cell-001",
    purpose: "Test",

    responsibilities: [],
    owns: [],
    excludes: [],
    inputs: [],
    outputs: [],
    constraints: [],

    relationships: [
      {
        type: "depends-on",
        target: "cell-002",
      },
      {
        type: "invalid",
      },
      "invalid",
    ],
  };

  const result = validateLivingContext(context);

  assert.equal(result.valid, false);

  assert.ok(
    result.errors.some((error) =>
      error.includes("relationships")
    )
  );

  console.log("✓ validate checks relationships structure");
}

// Test 10: Normalize 清理 relationships
{
  const input = {
    cellId: "cell-001",
    purpose: "Test",
    responsibilities: [],

    relationships: [
      {
        type: "  depends-on  ",
        target: "  cell-002  ",
      },
      {
        type: "",
        target: "cell-003",
      },
      {
        type: "provides-to",
      },
      null,
      "invalid",
    ],
  };

  const normalized = normalizeLivingContext(input);

  assert.deepEqual(
    normalized.relationships,
    [
      {
        type: "depends-on",
        target: "cell-002",
      },
    ]
  );

  console.log("✓ normalize cleans relationships");
}

// Test 11: Normalize 移除重複 relationships
{
  const input = {
    cellId: "cell-001",

    relationships: [
      {
        type: "depends-on",
        target: "cell-002",
      },
      {
        type: " depends-on ",
        target: " cell-002 ",
      },
    ],
  };

  const normalized = normalizeLivingContext(input);

  assert.deepEqual(
    normalized.relationships,
    [
      {
        type: "depends-on",
        target: "cell-002",
      },
    ]
  );

  console.log("✓ normalize removes duplicate relationships");
}

// Test 12: 空 Living Context 在新建階段合法
{
  const context = createLivingContext({
    cellId: "cell-001",
  });

  const result = validateLivingContext(context);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);

  console.log("✓ validate accepts empty living context with cellId");
}

console.log("\n✅ All Living Context Schema tests passed!");