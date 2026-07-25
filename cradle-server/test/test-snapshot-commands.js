import assert from "assert";
import { createSnapshotCommands } from "../src/commands/snapshot-commands.js";

function captureConsoleAsync(fn) {
  const originalLog = console.log;
  const output = [];

  console.log = (...args) => output.push(args.join(" "));

  return Promise.resolve()
    .then(fn)
    .then(() => output.join("\n"))
    .finally(() => {
      console.log = originalLog;
    });
}

function createEngine({
  cradleMode = false,
  snapshots = ["snap-1"],
} = {}) {
  const restored = [];
  const cell = {
    createSnapshot: async () => "snap-new",
    listSnapshots: async () => snapshots,
    restoreSnapshot: async (snapshotName) => {
      restored.push(snapshotName);
    },
  };

  return {
    restored,
    isCradleMode: () => cradleMode,
    getActiveCell: () => cell,
  };
}

const commands = createSnapshotCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/snapshot", "/snapshots", "/restore"]
);

const snapshot = commands.find((command) => command.name === "/snapshot");
const snapshots = commands.find((command) => command.name === "/snapshots");
const restore = commands.find((command) => command.name === "/restore");

assert.equal(snapshot.match("/snapshot", { engine: createEngine() }), true);
assert.equal(snapshot.match("/snapshot", { engine: createEngine({ cradleMode: true }) }), false);
assert.equal(snapshots.match("/snapshots", { engine: createEngine() }), true);
assert.equal(restore.match("/restore snap-1", { engine: createEngine() }), true);

const snapshotOutput = await captureConsoleAsync(() =>
  snapshot.execute({ engine: createEngine() })
);
assert.ok(snapshotOutput.includes("Snapshot created: snap-new"));

const listOutput = await captureConsoleAsync(() =>
  snapshots.execute({ engine: createEngine({ snapshots: ["snap-1", "snap-2"] }) })
);
assert.equal(listOutput, "snap-1\nsnap-2");

const emptyListOutput = await captureConsoleAsync(() =>
  snapshots.execute({ engine: createEngine({ snapshots: [] }) })
);
assert.equal(emptyListOutput, "(no snapshots)");

const restoreEngine = createEngine();
const restoreOutput = await captureConsoleAsync(() =>
  restore.execute({ engine: restoreEngine, input: "/restore snap-1" })
);
assert.deepEqual(restoreEngine.restored, ["snap-1"]);
assert.ok(restoreOutput.includes("Snapshot restored: snap-1"));

const usageOutput = await captureConsoleAsync(() =>
  restore.execute({ engine: createEngine(), input: "/restore " })
);
assert.ok(usageOutput.includes("Usage: /restore <snapshot-name>"));

console.log("Snapshot command tests passed");
