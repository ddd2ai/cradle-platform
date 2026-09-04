import assert from "node:assert/strict";
import test from "node:test";
import { StimulusFeedQueue } from "../src/services/stimulus-feed-queue.js";

test("feed queue accepts every stimulus immediately and bounds uploads", async () => {
  const pendingUploads = [];
  let running = 0;
  let maxRunning = 0;
  let nextId = 0;
  const queue = new StimulusFeedQueue({
    concurrency: 2,
    idFactory: () => `feed-${++nextId}`,
    upload: async (file, options) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      try {
        return await new Promise((resolve) => pendingUploads.push({ file, options, resolve }));
      } finally {
        running -= 1;
      }
    },
  });

  const created = queue.enqueue([
    stimulus("one.txt"),
    stimulus("two.txt"),
    stimulus("three.txt"),
    stimulus("four.txt"),
  ], { artifactType: "spec" });

  assert.equal(created.length, 4);
  assert.equal(queue.list().length, 4);
  await nextTurn();
  assert.equal(pendingUploads.length, 2);
  assert.equal(maxRunning, 2);
  assert.deepEqual(
    queue.list().filter((entry) => entry.state === "queued").map((entry) => entry.queuePosition).sort(),
    [1, 2],
  );

  while (queue.list().some((entry) => ["queued", "uploading"].includes(entry.state))) {
    const unresolved = pendingUploads.find((upload) => !upload.done);
    assert.ok(unresolved);
    unresolved.done = true;
    unresolved.resolve(operationFor(unresolved.file.name));
    await nextTurn();
  }
  await queue.whenIdle();

  assert.equal(maxRunning, 2);
  assert.equal(queue.list().filter((entry) => entry.state === "accepted").length, 4);
  assert.ok(pendingUploads.every((upload) => upload.options.artifactType === "spec"));
});

test("failed browser upload remains retryable without duplicating the feed item", async () => {
  let attempts = 0;
  const queue = new StimulusFeedQueue({
    idFactory: () => "feed-retry",
    upload: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("Backend unavailable");
      return operationFor("retry.txt");
    },
  });

  queue.enqueue([stimulus("retry.txt")]);
  await queue.whenIdle();
  assert.equal(queue.list()[0].state, "failed");
  assert.equal(queue.list()[0].error, "Backend unavailable");

  assert.equal(queue.retry("feed-retry"), true);
  await queue.whenIdle();
  assert.equal(attempts, 2);
  assert.equal(queue.list().length, 1);
  assert.equal(queue.list()[0].operation.operationId, "op-retry.txt");
});

test("authoritative operations can be restored without duplication", () => {
  const queue = new StimulusFeedQueue({ upload: async () => null });
  const operation = operationFor("restored.md");

  queue.adoptOperations([operation, operation]);

  assert.equal(queue.list().length, 1);
  assert.equal(queue.list()[0].sourceName, "restored.md");
  assert.equal(queue.list()[0].operation, operation);
});

test("a queued stimulus can be cancelled before REST acceptance", async () => {
  const gate = deferred();
  let nextId = 0;
  const queue = new StimulusFeedQueue({
    concurrency: 1,
    idFactory: () => `feed-${++nextId}`,
    upload: async (file) => {
      if (file.name === "first.txt") await gate.promise;
      return operationFor(file.name);
    },
  });
  queue.enqueue([stimulus("first.txt"), stimulus("second.txt")]);
  await nextTurn();

  assert.equal(queue.cancelQueued("feed-2"), true);
  assert.equal(queue.list().find((entry) => entry.feedId === "feed-2").state, "cancelled");
  gate.resolve();
  await queue.whenIdle();
  assert.equal(queue.list().find((entry) => entry.feedId === "feed-1").state, "accepted");
});

function stimulus(name) {
  return { name, type: "text/plain", size: 12 };
}

function operationFor(sourceName) {
  return {
    operationId: `op-${sourceName}`,
    type: "stimulus-cultivation",
    status: "accepted",
    context: { sourceName },
    createdAt: "2026-09-04T00:00:00.000Z",
  };
}

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
