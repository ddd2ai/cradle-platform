import assert from "assert";
import {
  renderEvolutionFileList,
  renderSnapshotList,
  renderStimuliList,
  renderWorkspaceSections,
} from "../src/commands/cell-list-renderer.js";

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

assert.ok(captureConsole(() => renderStimuliList([])).includes("(no stimuli)"));

const stimuli = captureConsole(() => {
  renderStimuliList([
    {
      category: "notes",
      file: "brief.md",
    },
  ]);
});
assert.ok(stimuli.includes("Situation Stimuli"));
assert.ok(stimuli.includes("[notes] brief.md"));

const workspace = captureConsole(() => {
  renderWorkspaceSections({
    notes: ["note.md"],
    decisions: [],
  });
});
assert.ok(workspace.includes("Workspace"));
assert.ok(workspace.includes("notes/"));
assert.ok(workspace.includes("  └─ note.md"));
assert.ok(workspace.includes("decisions/"));
assert.ok(workspace.includes("  └─ -"));

assert.ok(
  captureConsole(() => renderSnapshotList([])).includes("(no snapshots)")
);
assert.equal(
  captureConsole(() => renderSnapshotList(["snap-1", "snap-2"])),
  "snap-1\nsnap-2"
);

const evolutions = captureConsole(() => {
  renderEvolutionFileList(["b.txt", "z.md", "a.md"]);
});
assert.ok(evolutions.indexOf("a.md") < evolutions.indexOf("z.md"));
assert.ok(!evolutions.includes("b.txt"));

console.log("Cell list renderer tests passed");
