import assert from "assert";
import { createMemoryCommands } from "../src/commands/memory-commands.js";

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

function createEngine({ cradleMode = false } = {}) {
  const knowledge = [];

  return {
    knowledge,
    isCradleMode: () => cradleMode,
    getActiveCell: () => ({
      appendKnowledge: async (content) => knowledge.push(content),
    }),
  };
}

const commands = createMemoryCommands();
assert.deepEqual(
  commands.map((command) => command.name),
  ["/feed"]
);

const feed = commands[0];
assert.equal(feed.match("/feed useful fact", { engine: createEngine() }), true);
assert.equal(
  feed.match("/feed useful fact", { engine: createEngine({ cradleMode: true }) }),
  false
);

const engine = createEngine();
const output = await captureConsoleAsync(() =>
  feed.execute({ engine, input: "/feed useful fact" })
);
assert.ok(engine.knowledge[0].includes("useful fact"));
assert.ok(output.includes("Memory updated."));

const usageOutput = await captureConsoleAsync(() =>
  feed.execute({ engine: createEngine(), input: "/feed " })
);
assert.equal(usageOutput, "Usage: /feed <content>");

console.log("Memory command tests passed");
