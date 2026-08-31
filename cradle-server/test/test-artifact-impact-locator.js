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

console.log("Artifact impact locator tests passed");
