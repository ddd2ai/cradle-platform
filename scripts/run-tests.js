#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const tests = [
  "test/test-artifact-execution-service.js",
  "test/test-artifact-production-transformation.js",
  "test/test-artifact-regeneration-service.js",
  "test/test-artifact-type-policy.js",
  "test/test-artifact-validation.js",
  "test/test-cell-config-store.js",
  "test/test-cell-directory-preparer.js",
  "test/test-cell-dna-readiness-service.js",
  "test/test-cell-division-service.js",
  "test/test-cell-dna-store.js",
  "test/test-cell-evolution-store.js",
  "test/test-cell-fusion-service.js",
  "test/test-cell-inbox-store.js",
  "test/test-cell-lifecycle-event-store.js",
  "test/test-cell-living-context.js",
  "test/test-cell-memory-store.js",
  "test/test-cell-metabolism-service.js",
  "test/test-cell-paths.js",
  "test/test-cell-profile-store.js",
  "test/test-cell-profile.js",
  "test/test-cell-runtime-lifecycle-service.js",
  "test/test-cell-snapshot-store.js",
  "test/test-cell-task-processing-service.js",
  "test/test-cell-task-store.js",
  "test/test-cell-workspace-store.js",
  "test/test-command-input.js",
  "test/test-division-plan-schema.js",
  "test/test-division-renderer.js",
  "test/test-dna-lifecycle.js",
  "test/test-dna-maturity-integration.js",
  "test/test-dna-maturity.js",
  "test/test-fuse-command.js",
  "test/test-fuse-lifecycle.js",
  "test/test-fuse.js",
  "test/test-fusion-engine-contract.js",
  "test/test-fusion-plan-schema.js",
  "test/test-heartbeat-service.js",
  "test/test-json-parser.js",
  "test/test-lifecycle-apply.js",
  "test/test-lifecycle-repair.js",
  "test/test-living-context-fusion-service.js",
  "test/test-living-context-schema.js",
  "test/test-living-context-service.js",
  "test/test-living-context-store.js",
  "test/test-observation-store.js",
  "test/test-safe-path.js",
  "test/test-source-material-service.js",
  "test/test-stimulus-store.js",
  "test/test-svd-division.js",
  "test/test-text-file.js",
  "test/test-workspace-document-templates.js",
];

let failed = 0;

for (const test of tests) {
  console.log(`\n> node ${test}`);

  const result = spawnSync(process.execPath, [test], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    failed += 1;
    console.error(`\nTest failed: ${test}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} test file(s) failed.`);
  process.exit(1);
}

console.log(`\n${tests.length} test file(s) passed.`);
