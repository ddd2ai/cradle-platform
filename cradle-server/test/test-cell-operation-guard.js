import assert from "node:assert/strict";
import test from "node:test";
import { CellOperationGuard } from "../src/application/cell-operation-guard.js";

test("CellOperationGuard rejects overlapping operations for the same Cell", async () => {
  const guard = new CellOperationGuard();
  let releaseOperation;
  const operationGate = new Promise((resolve) => {
    releaseOperation = resolve;
  });
  const firstOperation = guard.run(["B01"], async () => {
    await operationGate;
    return "completed";
  });

  await assert.rejects(
    guard.run(["B01"], async () => "duplicate"),
    (error) => {
      assert.equal(error.code, "OPERATION_ALREADY_RUNNING");
      assert.match(error.message, /B01/);
      return true;
    },
  );

  releaseOperation();
  assert.equal(await firstOperation, "completed");
  assert.equal(
    await guard.run(["B01"], async () => "available"),
    "available",
  );
});

test("CellOperationGuard allows operations on independent Cells", async () => {
  const guard = new CellOperationGuard();

  const results = await Promise.all([
    guard.run(["B01"], async () => "B01"),
    guard.run(["cell-001"], async () => "cell-001"),
  ]);

  assert.deepEqual(results, ["B01", "cell-001"]);
});
