import assert from "assert";
import {
  renderCellGraph,
  renderCellTrace,
} from "../src/commands/cell-relationship-renderer.js";

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

const graph = captureConsole(() => {
  renderCellGraph({
    cellId: "cell-001",
    responsibilities: ["creation", "decision"],
    relationships: [
      {
        type: "depends-on",
        target: "cell-002",
      },
    ],
  });
});

assert.ok(graph.includes("cell-001"));
assert.ok(graph.includes("Responsibilities"));
assert.ok(graph.includes(" ├─ creation"));
assert.ok(graph.includes("Relationships"));
assert.ok(graph.includes(" ├─ depends-on -> cell-002"));

const trace = captureConsole(() => {
  renderCellTrace({
    cellId: "cell-001",
    relationships: [
      {
        type: "reported-to",
        target: "cell-003",
      },
    ],
  });
});

assert.ok(trace.includes("Trace: cell-001"));
assert.ok(trace.includes("cell-001 --reported-to--> cell-003"));

const emptyTrace = captureConsole(() => {
  renderCellTrace({
    cellId: "cell-001",
    relationships: [],
  });
});

assert.ok(emptyTrace.includes("(no relationships)"));

console.log("Cell relationship renderer tests passed");
