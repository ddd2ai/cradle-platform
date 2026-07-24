import assert from "assert";
import { createWorkspaceCommands } from "../src/commands/workspace-commands.js";

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

function createCell(id = "cell-001") {
  const writes = [];
  const files = new Map([["notes/source.md", "source content"]]);

  return {
    id,
    writes,
    files,
    ask: async () => ({ text: "```markdown\ncreated content\n```" }),
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
    listWorkspaceSections: async () => ({
      notes: ["source.md"],
      decisions: [],
    }),
  };
}

function createEngine({ cradleMode = false } = {}) {
  const activeCell = createCell();
  const otherCell = createCell("cell-002");
  const cells = new Map([
    [activeCell.id, activeCell],
    [otherCell.id, otherCell],
  ]);

  return {
    activeCell,
    otherCell,
    cells,
    isCradleMode: () => cradleMode,
    getActiveCell: () => activeCell,
    formatTimestamp: () => "20260724T100000",
    cleanMarkdownFence: (text) => text.replace(/^```markdown\n/, "").replace(/\n```$/, ""),
  };
}

const commands = createWorkspaceCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  [
    "/write",
    "/write-note",
    "/decide",
    "/research",
    "/read",
    "/revise",
    "/share",
    "/import",
    "/project-init",
    "/project-file",
    "/workspace",
  ]
);

const byName = new Map(commands.map((command) => [command.name, command]));

assert.equal(byName.get("/write").match("/write draft", { engine: createEngine() }), true);
assert.equal(
  byName.get("/write").match("/write draft", { engine: createEngine({ cradleMode: true }) }),
  false
);

const writeEngine = createEngine();
const writeOutput = await captureConsoleAsync(() =>
  byName.get("/write").execute({ engine: writeEngine, input: "/write draft" })
);
assert.equal(writeEngine.activeCell.writes[0].fileName, "artifacts/note-20260724T100000.md");
assert.equal(writeEngine.activeCell.writes[0].content, "created content");
assert.ok(writeOutput.includes("Workspace file created"));

const noteEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/write-note").execute({ engine: noteEngine, input: "/write-note remember this" })
);
assert.equal(noteEngine.activeCell.writes[0].fileName, "notes/note-20260724T100000.md");
assert.ok(noteEngine.activeCell.writes[0].content.includes("remember this"));

const readOutput = await captureConsoleAsync(() =>
  byName.get("/read").execute({ engine: createEngine(), input: "/read notes/source.md" })
);
assert.equal(readOutput, "source content");

const missingReadOutput = await captureConsoleAsync(() =>
  byName.get("/read").execute({ engine: createEngine(), input: "/read missing.md" })
);
assert.ok(missingReadOutput.includes("Workspace file not found: missing.md"));

const reviseEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/revise").execute({
    engine: reviseEngine,
    input: "/revise notes/source.md tighten",
  })
);
assert.equal(reviseEngine.activeCell.writes[0].fileName, "notes/source.md");
assert.equal(reviseEngine.activeCell.writes[0].content, "created content");

const shareEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/share").execute({
    engine: shareEngine,
    input: "/share notes/source.md cell-002",
  })
);
assert.equal(shareEngine.otherCell.files.get("notes/source.md"), "source content");

const importEngine = createEngine();
importEngine.activeCell.files.delete("notes/source.md");
await captureConsoleAsync(() =>
  byName.get("/import").execute({
    engine: importEngine,
    input: "/import cell-002 notes/source.md",
  })
);
assert.equal(importEngine.activeCell.files.get("notes/source.md"), "source content");

const projectEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/project-init").execute({
    engine: projectEngine,
    input: "/project-init alpha",
  })
);
assert.equal(projectEngine.activeCell.writes[0].fileName, "projects/alpha/README.md");

await captureConsoleAsync(() =>
  byName.get("/project-file").execute({
    engine: projectEngine,
    input: "/project-file alpha docs/plan.md",
  })
);
assert.equal(projectEngine.activeCell.writes[1].fileName, "projects/alpha/docs/plan.md");

const workspaceOutput = await captureConsoleAsync(() =>
  byName.get("/workspace").execute({ engine: createEngine() })
);
assert.ok(workspaceOutput.includes("Workspace"));
assert.ok(workspaceOutput.includes("notes/"));

const usageOutput = await captureConsoleAsync(() =>
  byName.get("/project-file").execute({
    engine: createEngine(),
    input: "/project-file alpha",
  })
);
assert.ok(usageOutput.includes("Usage: /project-file"));

console.log("Workspace command tests passed");
