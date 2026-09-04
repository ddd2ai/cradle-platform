import assert from "node:assert/strict";
import { locateArtifactChangeTargets } from "../src/production/artifact-impact-locator.js";

const artifact = {
  outputs: [
    {
      kind: "file",
      path: "src/main/java/example/PaymentService.java",
      content: "public class PaymentService {}",
    },
    {
      kind: "file",
      path: "src/main/java/example/OrderService.java",
      content: "public class OrderService {}",
    },
  ],
};

const located = locateArtifactChangeTargets({
  artifact,
  task: { title: "修正編譯錯誤" },
  executionResult: {
    stderr: "src/main/java/example/PaymentService.java:[42,9] cannot find symbol",
  },
});
assert.deepEqual(located.paths, ["src/main/java/example/PaymentService.java"]);
assert.ok(located.confidence >= 0.8);

assert.deepEqual(
  locateArtifactChangeTargets({
    artifact: { outputs: [artifact.outputs[0]] },
    task: { title: "修正行為" },
  }).paths,
  ["src/main/java/example/PaymentService.java"]
);

assert.deepEqual(
  locateArtifactChangeTargets({
    artifact,
    task: { title: "改善未知問題" },
    executionResult: { error: "unknown" },
  }).paths,
  []
);

const artifactScope = locateArtifactChangeTargets({
  artifact,
  scope: "artifact",
  task: { title: "改用 H2 資料庫" },
});
assert.deepEqual(artifactScope.paths, artifact.outputs.map((output) => output.path));
assert.match(artifactScope.reason, /outputs directory/);

const h2Targets = locateArtifactChangeTargets({
  artifact: {
    outputs: [
      { kind: "file", path: "pom.xml", content: "spring-boot-starter-data-jpa" },
      { kind: "file", path: "src/main/resources/application.yml", content: "spring.datasource.url" },
      { kind: "file", path: "src/main/java/example/OrderService.java", content: "class OrderService {}" },
    ],
  },
  task: { title: "改用 H2 資料庫" },
});
assert.deepEqual(h2Targets.paths, ["pom.xml", "src/main/resources/application.yml"]);
assert.match(h2Targets.reason, /bounded build/);

const indexedOnly = locateArtifactChangeTargets({
  artifact: {
    outputs: [{
      kind: "file",
      path: "src/IndexedService.java",
      language: "java",
      contentHash: "hash-only",
      declaredSymbols: ["IndexedService", "calculateTotal"],
    }],
  },
  executionResult: { error: "calculateTotal returned an invalid value" },
});
assert.deepEqual(indexedOnly.paths, ["src/IndexedService.java"]);

const indexedCandidatesOnly = locateArtifactChangeTargets({
  artifact: {
    outputs: [
      {
        kind: "file",
        path: "src/SelectedService.js",
        declaredSymbols: ["SelectedService"],
      },
      {
        kind: "file",
        path: "src/UnselectedService.js",
        get declaredSymbols() {
          throw new Error("locator scanned an output outside indexed candidates");
        },
      },
    ],
  },
  task: { title: "修正 SelectedService" },
  candidatePaths: ["src/SelectedService.js"],
});
assert.deepEqual(indexedCandidatesOnly.paths, ["src/SelectedService.js"]);

console.log("Artifact impact locator tests passed");
