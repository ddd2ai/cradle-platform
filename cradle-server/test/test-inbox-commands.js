import assert from "assert";
import { createInboxCommands } from "../src/commands/inbox-commands.js";

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

function createEngine({ cradleMode = false, inbox = [] } = {}) {
  const writes = [];
  const messages = [];
  const clearCalls = [];
  const activeCell = {
    id: "cell-001",
    readInbox: async () => inbox,
    ask: async () => ({ text: "```markdown\ninbox digest\n```" }),
    writeWorkspaceFile: async (fileName, content) => {
      writes.push({ fileName, content });
    },
    processInbox: async (items) => ({
      processed: items.length,
      summary: "Processed inbox.",
    }),
    clearInbox: async () => clearCalls.push(activeCell.id),
  };

  return {
    writes,
    messages,
    clearCalls,
    inboxes: new Map([[activeCell.id, inbox]]),
    cells: new Map([
      [activeCell.id, activeCell],
      ["cell-002", { id: "cell-002" }],
    ]),
    isCradleMode: () => cradleMode,
    getActiveCell: () => activeCell,
    pushMessage: async (message) => messages.push(message),
    formatTimestamp: () => "20260724T100000",
    cleanMarkdownFence: (text) => text.replace(/^```markdown\n/, "").replace(/\n```$/, ""),
  };
}

const commands = createInboxCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/inbox", "/send", "/digest", "/process", "/clean-inbox"]
);

const byName = new Map(commands.map((command) => [command.name, command]));

assert.equal(byName.get("/inbox").match("/inbox", { engine: createEngine() }), true);
assert.equal(
  byName.get("/inbox").match("/inbox", { engine: createEngine({ cradleMode: true }) }),
  false
);

const inboxEngine = createEngine({
  inbox: [
    {
      type: "message",
      createdAt: "2026-07-24T10:00:00.000Z",
      from: "cell-002",
      to: "cell-001",
      content: "hello",
    },
  ],
});
const inboxOutput = await captureConsoleAsync(() =>
  byName.get("/inbox").execute({ engine: inboxEngine })
);
assert.equal(inboxEngine.inboxes.get("cell-001").length, 1);
assert.ok(inboxOutput.includes("[message] 2026-07-24T10:00:00.000Z"));

const sendEngine = createEngine();
await captureConsoleAsync(() =>
  byName.get("/send").execute({
    engine: sendEngine,
    input: "/send cell-002 hello there",
  })
);
assert.deepEqual(sendEngine.messages, [
  {
    from: "cell-001",
    to: "cell-002",
    type: "message",
    content: "hello there",
  },
]);

const missingTargetOutput = await captureConsoleAsync(() =>
  byName.get("/send").execute({
    engine: createEngine(),
    input: "/send cell-404 hello",
  })
);
assert.ok(missingTargetOutput.includes("Target cell not found: cell-404"));

const digestEngine = createEngine({ inbox: [{ content: "status" }] });
const digestOutput = await captureConsoleAsync(() =>
  byName.get("/digest").execute({ engine: digestEngine })
);
assert.equal(digestEngine.writes[0].fileName, "digest-20260724T100000.md");
assert.equal(digestEngine.writes[0].content, "inbox digest");
assert.ok(digestOutput.includes("Inbox digest created."));

const emptyDigestOutput = await captureConsoleAsync(() =>
  byName.get("/digest").execute({ engine: createEngine() })
);
assert.equal(emptyDigestOutput, "(empty inbox)");

const processEngine = createEngine({ inbox: [{ content: "status" }] });
const processOutput = await captureConsoleAsync(() =>
  byName.get("/process").execute({ engine: processEngine })
);
assert.deepEqual(processEngine.inboxes.get("cell-001"), []);
assert.deepEqual(processEngine.clearCalls, ["cell-001"]);
assert.ok(processOutput.includes("Inbox processed."));
assert.ok(processOutput.includes("Processed inbox."));

const cleanEngine = createEngine({ inbox: [{ content: "status" }] });
await captureConsoleAsync(() =>
  byName.get("/clean-inbox").execute({ engine: cleanEngine })
);
assert.deepEqual(cleanEngine.inboxes.get("cell-001"), []);
assert.deepEqual(cleanEngine.clearCalls, ["cell-001"]);

console.log("Inbox command tests passed");
