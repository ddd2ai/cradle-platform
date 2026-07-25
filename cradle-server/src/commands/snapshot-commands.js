import { commandArgs } from "./command-input.js";
import { renderSnapshotList } from "./cell-list-renderer.js";

export function createSnapshotCommands() {
  return [
    {
      name: "/snapshot",
      match: (input, { engine }) => input === "/snapshot" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        const snapshot = await engine.getActiveCell().createSnapshot();
        console.log(`Snapshot created: ${snapshot}`);
      },
    },

    {
      name: "/snapshots",
      match: (input, { engine }) => input === "/snapshots" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        const snapshots = await engine.getActiveCell().listSnapshots();
        renderSnapshotList(snapshots);
      },
    },

    {
      name: "/restore",
      match: (input, { engine }) => input.startsWith("/restore ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const snapshotName = commandArgs(input, "/restore");

        if (!snapshotName) {
          console.log("Usage: /restore <snapshot-name>");
          return;
        }

        await engine.getActiveCell().restoreSnapshot(snapshotName);
        console.log(`Snapshot restored: ${snapshotName}`);
      },
    },
  ];
}
