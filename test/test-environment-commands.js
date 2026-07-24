import assert from "assert";
import { createEnvironmentCommands } from "../src/commands/environment-commands.js";

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

const tools = [
  {
    name: "java",
    install: "brew install openjdk",
  },
  {
    name: "maven",
    install: "brew install maven",
  },
];

const installed = new Set(["java"]);
const installs = [];
let closed = false;

const commands = createEnvironmentCommands({
  resolveEnvironmentFn: async () => tools,
  isInstalledFn: async (tool) => installed.has(tool.name),
  installToolFn: async (tool) => installs.push(tool.name),
  createReadlineInterface: () => ({
    question: async () => "Y",
    close: () => {
      closed = true;
    },
  }),
});

assert.deepEqual(
  commands.map((command) => command.name),
  ["/env plan", "/env prepare"]
);

const byName = new Map(commands.map((command) => [command.name, command]));
assert.equal(byName.get("/env plan").match("/env plan"), true);
assert.equal(byName.get("/env prepare").match("/env prepare"), true);

const planOutput = await captureConsoleAsync(() =>
  byName.get("/env plan").execute()
);
assert.ok(planOutput.includes("Environment Plan"));
assert.ok(planOutput.includes("✓ java"));
assert.ok(planOutput.includes("✗ maven"));

const prepareOutput = await captureConsoleAsync(() =>
  byName.get("/env prepare").execute()
);
assert.ok(prepareOutput.includes("Preparing Environment"));
assert.ok(prepareOutput.includes("✓ java"));
assert.ok(prepareOutput.includes("✗ maven"));
assert.ok(prepareOutput.includes("✓ maven installed"));
assert.ok(prepareOutput.includes("Environment Ready"));
assert.deepEqual(installs, ["maven"]);
assert.equal(closed, true);

const emptyCommands = createEnvironmentCommands({
  resolveEnvironmentFn: async () => [],
});
const emptyOutput = await captureConsoleAsync(() =>
  emptyCommands[0].execute()
);
assert.equal(emptyOutput, "(no tools detected)");

console.log("Environment command tests passed");
