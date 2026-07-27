import assert from "node:assert/strict";
import test from "node:test";
import { CellStabilizationService } from "../src/application/cell-stabilization-service.js";

test("stabilization logs a diagnosis-only completion", async () => {
  const logs = createLogCollector();
  let executionCalled = false;
  const service = createService({
    logger: logs.logger,
    executionService: {
      async execute() {
        executionCalled = true;
      },
    },
  });
  const cell = createCell({
    proposal: {
      action: "stay",
      reason: "No repair is required",
    },
  });

  const result = await service.stabilize(cell);

  assert.equal(result.status, "completed");
  assert.equal(result.patched, false);
  assert.equal(executionCalled, false);
  assert.match(logs.messages[0], /\[stabilize\] cell=B01 started/);
  assert.ok(logs.messages.some((message) =>
    message.includes("diagnosed action=stay repairType=none artifactId=none")
  ));
  assert.ok(logs.messages.some((message) =>
    message.includes("completed status=completed patched=false verified=true")
  ));
});

test("stabilization logs artifact repair execution and completion", async () => {
  const logs = createLogCollector();
  const service = createService({
    logger: logs.logger,
    executionService: {
      async execute(proposal) {
        assert.equal(proposal.status, "executing");
        return { status: "completed", result: { stable: true } };
      },
    },
  });
  const cell = createCell({
    proposal: {
      action: "repair",
      repairType: "artifact",
      artifactId: "artifact-001",
    },
  });

  const result = await service.stabilize(cell);

  assert.equal(result.patched, true);
  assert.equal(result.verified, true);
  assert.ok(logs.messages.some((message) =>
    message.includes(
      "repair started repairType=artifact artifactId=artifact-001"
    )
  ));
  assert.ok(logs.messages.some((message) =>
    message.includes(
      "completed status=completed patched=true verified=true repairType=artifact artifactId=artifact-001"
    )
  ));
});

test("stabilization logs unexpected failures before rethrowing", async () => {
  const logs = createLogCollector();
  const service = createService({
    logger: logs.logger,
    snapshotService: {
      async create() {
        throw new Error("snapshot unavailable");
      },
    },
  });

  await assert.rejects(
    () => service.stabilize(createCell()),
    /snapshot unavailable/
  );
  assert.ok(logs.errors.some((message) =>
    message.includes("cell=B01 failed error=snapshot unavailable")
  ));
});

function createService({
  logger,
  snapshotService = { async create() { return { id: "snapshot-001" }; } },
  executionService = { async execute() { return { status: "completed" }; } },
} = {}) {
  return new CellStabilizationService({
    engine: {},
    logger,
    snapshotService,
    executionService,
  });
}

function createCell({
  proposal = { action: "stay" },
} = {}) {
  return {
    id: "B01",
    async observeCradle(snapshot) {
      assert.equal(snapshot.id, "snapshot-001");
      return { health: "healthy" };
    },
    async proposeLifecycle() {
      return proposal;
    },
  };
}

function createLogCollector() {
  const messages = [];
  const errors = [];

  return {
    messages,
    errors,
    logger: {
      info(message) {
        messages.push(message);
      },
      warn(message) {
        messages.push(message);
      },
      error(message) {
        errors.push(message);
      },
    },
  };
}
