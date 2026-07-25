import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { CellInboxStore } from "../src/cell/cell-inbox-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-inbox-store-")
);
const inboxDir = path.join(tempRoot, "inbox");
const inboxFile = path.join(inboxDir, "messages.json");

const store = new CellInboxStore({
  inboxDir,
  inboxFile,
});

assert.deepEqual(await store.readInbox(), []);

const firstMessage = {
  id: "message-001",
  from: "cell-a",
  to: "cell-b",
  type: "message",
  content: "hello",
  createdAt: "2026-07-23T10:00:00.000Z",
};

const secondMessage = {
  id: "message-002",
  from: "cell-c",
  to: "cell-b",
  type: "task",
  content: "do work",
  createdAt: "2026-07-23T10:05:00.000Z",
};

assert.deepEqual(await store.appendInboxMessage(firstMessage), [firstMessage]);
assert.deepEqual(await store.appendInboxMessage(secondMessage), [
  firstMessage,
  secondMessage,
]);
assert.deepEqual(await store.readInbox(), [
  firstMessage,
  secondMessage,
]);

await store.clearInbox();
assert.deepEqual(await store.readInbox(), []);

await store.writeInbox([secondMessage]);
assert.deepEqual(await store.readInbox(), [secondMessage]);

assert.throws(
  () => new CellInboxStore({ inboxFile }),
  /requires inboxDir/
);
assert.throws(
  () => new CellInboxStore({ inboxDir }),
  /requires inboxFile/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellInboxStore tests passed");
