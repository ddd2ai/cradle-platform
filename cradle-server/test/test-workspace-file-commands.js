import assert from "assert";
import { createWorkspaceFileCommands } from "../src/commands/workspace-file-commands.js";

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

function createCell(id, files = new Map()) {
  const writes = [];

  return {
    id,
    files,
    writes,
    ask: async () => ({ text: "```markdown\nrevised content\n```" }),
    writeWorkspaceFile: async (fileName, content) => {
      writes.push({ fileName, content });
      files.set(fileName, content);
    },
    readWorkspaceFile: async (fileName) => {
      if (!files.has(fileName)) {
        throw new Error("missing");
      }

      return files.get(fileName);
    },
  };
}

function createEngine({ cradleMode = false } = {}) {
  const activeCell = createCell(
    "cell-001",
    new Map([["notes/source.md", "source content"]])
  );
  const otherCell = createCell(
    "cell-002",
    new Map([["notes/source.md", "other content"]])
  );

  return {
    activeCell,
    otherCell,
    cells: new Map([
      [activeCell.id, activeCell],
      [otherCell.id, otherCell],
    ]),
    isCradleMode: () => cradleMode,
    getActiveCell: () => activeCell,
    cleanMarkdownFence: (text) => text.replace(/^```markdown\n/, "").replace(/\n```$/, ""),
  };
}

const commands = createWorkspaceFileCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/read", "/revise", "/share", "/import"]
);

const byName = new Map(commands.map((command) => [command.name, command]));
assert.equal(byName.get("/read").match("/read notes/source.md", { engine: createEngine() }), true);
assert.equal(
  byName.get("/read").match("/read notes/source.md", { engine: createEngine({ cradleMode: true }) }),
  false
);

const readOutput = await captureConsoleAsync(() =>
  byName.get("/read").execute({ engine: createEngine(), input: "/read notes/source.md" })
);
assert.equal(readOutput, "source content");

const missingReadOutput = await captureConsoleAsync(() =>
  byName.get("/read").execute({ engine: createEngine(), input: "/read missing.md" })
);
assert.equal(missingReadOutput, "Workspace file not found: missing.md");

const reviseEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/revise").execute({
    engine: reviseEngine,
    input: "/revise notes/source.md tighten",
  })
);
assert.equal(reviseEngine.activeCell.writes[0].fileName, "notes/source.md");
assert.equal(reviseEngine.activeCell.writes[0].content, "revised content");

const shareEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/share").execute({
    engine: shareEngine,
    input: "/share notes/source.md cell-002",
  })
);
assert.equal(shareEngine.otherCell.files.get("notes/source.md"), "source content");

const missingTargetOutput = await captureConsoleAsync(() =>
  byName.get("/share").execute({
    engine: createEngine(),
    input: "/share notes/source.md missing-cell",
  })
);
assert.equal(missingTargetOutput, "Target cell not found: missing-cell");

const importEngine = createEngine();
importEngine.activeCell.files.delete("notes/source.md");
await captureConsoleAsync(() =>
  byName.get("/import").execute({
    engine: importEngine,
    input: "/import cell-002 notes/source.md",
  })
);
assert.equal(importEngine.activeCell.files.get("notes/source.md"), "other content");

const usageOutput = await captureConsoleAsync(() =>
  byName.get("/import").execute({
    engine: createEngine(),
    input: "/import cell-002",
  })
);
assert.equal(usageOutput, "Usage: /import <source-cell-id> <workspace-file>");

console.log("Workspace file command tests passed");
