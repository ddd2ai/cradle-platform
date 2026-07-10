/**
 * test-cell-living-context.js
 *
 * 測試 CradleCell 的 Living Context 讀寫與持久化
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { CradleCell } from "../src/cradle-cell.js";

console.log("Testing CradleCell Living Context...\n");

const originalCwd = process.cwd();

const tmpBase = path.join(
  os.tmpdir(),
  `cradle-cell-test-${Date.now()}`
);

await fs.mkdir(tmpBase, {
  recursive: true,
});

console.log(`Using temp directory: ${tmpBase}\n`);

/**
 * 建立測試 Cell。
 */
async function createTestCell(
  id,
  profileOverrides = {}
) {
  const cell = new CradleCell({
    id,
    provider: "ollama",
    model: "test-model",
  });

  await cell.prepareCellDirectory();

  const profilePath = path.join(
    cell.rootDir,
    "profile.json"
  );

  const profile = {
    id,
    cellId: id,
    purpose: "",
    responsibilities: [],
    ...profileOverrides,
  };

  await fs.writeFile(
    profilePath,
    JSON.stringify(profile, null, 2),
    "utf8"
  );

  await cell.prepareLivingContext();

  return cell;
}

/**
 * 模擬 Cell restart。
 *
 * 不呼叫完整 prepare()，
 * 避免初始化 config/VISION.md 等全域環境檔案。
 */
async function restartTestCell(id) {
  const cell = new CradleCell({
    id,
    provider: "ollama",
    model: "test-model",
  });

  await cell.prepareCellDirectory();
  await cell.prepareLivingContext();

  return cell;
}

try {
  process.chdir(tmpBase);

  // --------------------------------------------------
  // Test 1: prepareLivingContext 會建立檔案
  // --------------------------------------------------
  {
    const cell = await createTestCell(
      "cell-001",
      {
        purpose: "Test cell",
        responsibilities: [
          "Testing",
        ],
      }
    );

    const livingContextPath = path.join(
      cell.rootDir,
      "living-context.json"
    );

    const exists = await fs
      .access(livingContextPath)
      .then(() => true)
      .catch(() => false);

    assert.ok(
      exists,
      [
        "living-context.json should be created",
        `expected: ${path.resolve(
          livingContextPath
        )}`,
      ].join("\n")
    );

    const context =
      await cell.readLivingContext();

    assert.equal(
      context.cellId,
      "cell-001"
    );

    assert.ok(
      context.responsibilities.includes(
        "Testing"
      )
    );

    console.log(
      "✓ prepareLivingContext creates file"
    );
  }

  // --------------------------------------------------
  // Test 2: Write and Read Consistency
  // --------------------------------------------------
  {
    const cell =
      await createTestCell("cell-002");

    const testContext = {
      cellId: "cell-002",

      purpose:
        "Handle test scenarios",

      responsibilities: [
        "Test Execution",
        "Result Validation",
      ],

      owns: [
        "Test Database",
      ],

      excludes: [],

      inputs: [
        "Test Data",
      ],

      outputs: [
        "Test Report",
      ],

      constraints: [
        "No production access",
      ],

      relationships: [],
    };

    await cell.writeLivingContext(
      testContext
    );

    const readContext =
      await cell.readLivingContext();

    assert.equal(
      readContext.purpose,
      testContext.purpose
    );

    assert.deepEqual(
      readContext.responsibilities,
      testContext.responsibilities
    );

    assert.deepEqual(
      readContext.owns,
      testContext.owns
    );

    assert.deepEqual(
      readContext.inputs,
      testContext.inputs
    );

    assert.deepEqual(
      readContext.outputs,
      testContext.outputs
    );

    assert.deepEqual(
      readContext.constraints,
      testContext.constraints
    );

    console.log(
      "✓ write and read consistency"
    );
  }

  // --------------------------------------------------
  // Test 3: Restart 後 Living Context 應該保留
  // --------------------------------------------------
  {
    const cell1 =
      await createTestCell("cell-003");

    const originalContext = {
      cellId: "cell-003",

      purpose:
        "Original purpose",

      responsibilities: [
        "Original Task",
      ],

      owns: [],
      excludes: [],
      inputs: [],
      outputs: [],
      constraints: [],
      relationships: [],
    };

    await cell1.writeLivingContext(
      originalContext
    );

    const cell2 =
      await restartTestCell("cell-003");

    const loadedContext =
      await cell2.readLivingContext();

    assert.equal(
      loadedContext.purpose,
      "Original purpose"
    );

    assert.deepEqual(
      loadedContext.responsibilities,
      ["Original Task"]
    );

    console.log(
      "✓ restart preserves living context"
    );
  }

  // --------------------------------------------------
  // Test 4: 手動修改後不應被 prepare 覆蓋
  // --------------------------------------------------
  {
    const cell1 = await createTestCell(
      "cell-004",
      {
        purpose: "Test cell 4",

        responsibilities: [
          "Profile Task",
        ],
      }
    );

    const manualContext = {
      cellId: "cell-004",

      purpose:
        "Manually modified purpose",

      responsibilities: [
        "Manual Task 1",
        "Manual Task 2",
      ],

      owns: [
        "Manual Resource",
      ],

      excludes: [],
      inputs: [],
      outputs: [],
      constraints: [],
      relationships: [],
    };

    await cell1.writeLivingContext(
      manualContext
    );

    const cell2 =
      await restartTestCell("cell-004");

    const loadedContext =
      await cell2.readLivingContext();

    assert.equal(
      loadedContext.purpose,
      "Manually modified purpose"
    );

    assert.ok(
      loadedContext.responsibilities.includes(
        "Manual Task 1"
      )
    );

    assert.ok(
      loadedContext.responsibilities.includes(
        "Manual Task 2"
      )
    );

    assert.deepEqual(
      loadedContext.owns,
      ["Manual Resource"]
    );

    console.log(
      "✓ manual modifications are not overwritten"
    );
  }

  // --------------------------------------------------
  // Test 5: Responsibilities 應 merge
  // --------------------------------------------------
  {
    const cell1 = await createTestCell(
      "cell-005",
      {
        purpose: "Test cell 5",

        responsibilities: [
          "Profile Task A",
          "Profile Task B",
        ],
      }
    );

    const existing =
      await cell1.readLivingContext();

    existing.responsibilities = [
      "Manual Task X",
      "Manual Task Y",
    ];

    await cell1.writeLivingContext(
      existing
    );

    const cell2 =
      await restartTestCell("cell-005");

    const merged =
      await cell2.readLivingContext();

    assert.ok(
      merged.responsibilities.includes(
        "Profile Task A"
      )
    );

    assert.ok(
      merged.responsibilities.includes(
        "Profile Task B"
      )
    );

    assert.ok(
      merged.responsibilities.includes(
        "Manual Task X"
      )
    );

    assert.ok(
      merged.responsibilities.includes(
        "Manual Task Y"
      )
    );

    console.log(
      "✓ responsibilities are merged, not overwritten"
    );
  }

  // --------------------------------------------------
  // Test 6: Merge 應移除重複值
  // --------------------------------------------------
  {
    const cell1 = await createTestCell(
      "cell-006",
      {
        purpose: "Test cell 6",

        responsibilities: [
          "Task A",
          "Task B",
        ],
      }
    );

    const existing =
      await cell1.readLivingContext();

    existing.responsibilities = [
      "Task B",
      "Task C",
    ];

    await cell1.writeLivingContext(
      existing
    );

    const cell2 =
      await restartTestCell("cell-006");

    const merged =
      await cell2.readLivingContext();

    assert.equal(
      merged.responsibilities.length,
      3
    );

    assert.ok(
      merged.responsibilities.includes(
        "Task A"
      )
    );

    assert.ok(
      merged.responsibilities.includes(
        "Task B"
      )
    );

    assert.ok(
      merged.responsibilities.includes(
        "Task C"
      )
    );

    console.log(
      "✓ merge removes duplicates"
    );
  }

  console.log(
    "\n✅ All CradleCell Living Context tests passed!"
  );

  // --------------------------------------------------
  // Test 7: Profile 不存在時仍可建立 Living Context
  // --------------------------------------------------
  {
    const cell = new CradleCell({
      id: "cell-no-profile",
      provider: "ollama",
      model: "test-model",
    });

    await cell.prepareCellDirectory();

    // 不寫入 profile.json，直接呼叫 prepareLivingContext
    await cell.prepareLivingContext();

    const context =
      await cell.readLivingContext();

    assert.equal(
      context.cellId,
      "cell-no-profile"
    );

    assert.deepEqual(
      context.responsibilities,
      []
    );

    assert.equal(
      context.purpose,
      ""
    );

    console.log(
      "✓ missing profile does not break Living Context"
    );
  }
} finally {
  process.chdir(originalCwd);

  await fs.rm(tmpBase, {
    recursive: true,
    force: true,
  });
}