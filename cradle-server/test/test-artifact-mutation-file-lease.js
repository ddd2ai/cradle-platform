import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ArtifactMutationFileLease,
} from "../src/production/artifact-mutation-file-lease.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-artifact-lease-"));
const artifactDir = path.join(root, "artifact-shared");
const firstLease = new ArtifactMutationFileLease({
  minRetryMs: 1,
  maxRetryMs: 2,
});
const secondLease = new ArtifactMutationFileLease({
  minRetryMs: 1,
  maxRetryMs: 2,
});
let releaseFirst;
const firstGate = new Promise((resolve) => {
  releaseFirst = resolve;
});
const events = [];
const first = firstLease.runExclusive(artifactDir, async () => {
  events.push("first-start");
  await firstGate;
  events.push("first-end");
});
await waitFor(() => events.includes("first-start"));
let secondStats;
const second = secondLease.runExclusive(artifactDir, async (stats) => {
  secondStats = stats;
  events.push("second-start");
});
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(events.includes("second-start"), false);
releaseFirst();
await Promise.all([first, second]);
assert.deepEqual(events, ["first-start", "first-end", "second-start"]);
assert.equal(secondStats.contentionCount > 0, true);
assert.equal(
  await exists(path.join(artifactDir, ".mutation.lock")),
  false
);

const staleArtifactDir = path.join(root, "artifact-stale");
const staleLockDir = path.join(staleArtifactDir, ".mutation.lock");
await fs.mkdir(staleLockDir, { recursive: true });
await fs.writeFile(
  path.join(staleLockDir, "owner.json"),
  JSON.stringify({ token: "abandoned" }),
  "utf8"
);
const staleTime = new Date(Date.now() - 60_000);
await fs.utimes(staleLockDir, staleTime, staleTime);
const staleLease = new ArtifactMutationFileLease({
  staleAfterMs: 10,
  minRetryMs: 1,
  maxRetryMs: 1,
});
let staleStats;
await staleLease.runExclusive(staleArtifactDir, async (stats) => {
  staleStats = stats;
});
assert.equal(staleStats.staleRecovered, 1);
assert.equal(await exists(staleLockDir), false);

await assert.rejects(
  () => staleLease.runExclusive(
    path.join(root, "artifact-failed"),
    async () => {
      throw new Error("mutation failed");
    }
  ),
  /mutation failed/
);
assert.equal(
  await exists(path.join(root, "artifact-failed", ".mutation.lock")),
  false
);

await fs.rm(root, { recursive: true, force: true });
console.log("Artifact mutation file lease tests passed");

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("Timed out waiting for lease test condition");
}
