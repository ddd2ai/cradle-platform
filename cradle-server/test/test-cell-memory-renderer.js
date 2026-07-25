import assert from "assert";
import { renderFullMemory } from "../src/commands/cell-memory-renderer.js";

function captureConsole(fn) {
  const originalLog = console.log;
  const output = [];

  console.log = (...args) => output.push(args.join(" "));

  try {
    fn();
  } finally {
    console.log = originalLog;
  }

  return output.join("\n");
}

const output = captureConsole(() => {
  renderFullMemory({
    identity: "identity text",
    rules: "rules text",
    knowledge: "knowledge text",
    history: "history text",
  });
});

assert.ok(output.includes("# Identity"));
assert.ok(output.includes("identity text"));
assert.ok(output.includes("# Rules"));
assert.ok(output.includes("rules text"));
assert.ok(output.includes("# Knowledge"));
assert.ok(output.includes("knowledge text"));
assert.ok(output.includes("# History"));
assert.ok(output.includes("history text"));

console.log("Cell memory renderer tests passed");
