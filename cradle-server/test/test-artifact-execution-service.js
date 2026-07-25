import fs from "fs/promises";
import os from "os";
import path from "path";
import { ArtifactStore } from "../src/production/artifact-store.js";
import { ArtifactExecutionService } from "../src/execution/artifact-execution-service.js";
import { classifyExecutionStimulus } from "../src/situation/execution-stimulus.js";

console.log("Testing ArtifactExecutionService...\n");

let passed = 0;
let failed = 0;

function report(name, ok, message = "") {
  if (ok) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.error(`✗ ${name}`);
    if (message) {
      console.error(`  ${message}`);
    }
    failed++;
  }
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-execution-test-"));
const productionsDir = path.join(tempDir, "productions");
const executionsDir = path.join(tempDir, "executions");

try {
  const store = new ArtifactStore({ productionsDir });

  await store.saveArtifact({
    id: "artifact-document",
    type: "document",
    title: "Planning Document",
    goal: "Describe a boundary",
    outputs: [
      {
        kind: "file",
        path: "README.md",
        language: "markdown",
        content: "# Planning Document\n"
      }
    ],
  });

  const service = new ArtifactExecutionService({
    productionsDir,
    executionsDir,
  });

  const result = await service.executeArtifact("artifact-document");

  report(
    "Document artifact execution is skipped",
    result.status === "skipped",
    `Expected skipped, got ${result.status}`
  );

  report(
    "Skipped execution is classified as signal",
    classifyExecutionStimulus(result) === "signals",
    `Expected signals, got ${classifyExecutionStimulus(result)}`
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
