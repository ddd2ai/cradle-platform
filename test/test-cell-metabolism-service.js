import assert from "assert";
import { CellMetabolismService } from "../src/cell/cell-metabolism-service.js";

const serviceForFormatting = new CellMetabolismService({
  cell: {
    id: "cell-format",
  },
});

assert.equal(serviceForFormatting.formatObservationMarkdown(null), "(empty)");
assert.equal(serviceForFormatting.formatObservationMarkdown("raw"), "raw");
assert.ok(
  serviceForFormatting.formatObservationMarkdown({
    summary: "Build succeeded",
    facts: ["Tests passed"],
    interpretations: ["The current change appears stable"],
    hypotheses: ["May be ready for commit"],
    unknowns: ["CI status"],
    nextActions: ["Check CI"],
  }).includes("- Tests passed")
);

const noStimuliService = new CellMetabolismService({
  cell: {
    id: "cell-empty",
    async readStimuli() {
      return [];
    },
  },
});

assert.deepEqual(await noStimuliService.metabolize(), {
  created: 0,
  reason: "no stimuli",
});

const calls = [];
const stimuli = [
  {
    category: "threats",
    file: "failure.md",
    content: "unit test failed",
  },
];
const cell = {
  id: "cell-metabolism",
  observationStore: {
    async writeObservationMarkdown(content) {
      calls.push({ type: "writeObservationMarkdown", content });
      return "observations/observation.md";
    },
  },
  async readStimuli() {
    calls.push({ type: "readStimuli" });
    return stimuli;
  },
  async buildMemoryContext() {
    calls.push({ type: "buildMemoryContext" });
    return "memory context";
  },
  async askWithTimeout(input, timeoutMs) {
    calls.push({ type: "askWithTimeout", input, timeoutMs });
    return {
      text: JSON.stringify({
        observation: {
          summary: "A failure was observed",
          facts: ["unit test failed"],
        },
        tasks: [
          {
            title: "Investigate unit test",
            content: "Find the failing assertion",
          },
          {
            title: "Ignored second task",
          },
        ],
      }),
    };
  },
  async addTask(task) {
    calls.push({ type: "addTask", task });
  },
  async archiveStimuli(items) {
    calls.push({ type: "archiveStimuli", items });
  },
};

const service = new CellMetabolismService({ cell });
const result = await service.metabolize();

assert.deepEqual(result, {
  created: 1,
  observationFile: "observations/observation.md",
});

const askCall = calls.find((call) => call.type === "askWithTimeout");
assert.ok(askCall.input.includes("cell-metabolism"));
assert.ok(askCall.input.includes("failure.md"));
assert.ok(askCall.input.includes("memory context"));
assert.equal(askCall.timeoutMs, 3_600_000);

assert.deepEqual(
  calls.find((call) => call.type === "addTask").task,
  {
    title: "Investigate unit test",
    source: "metabolism",
    content: "Find the failing assertion",
  }
);
assert.equal(
  calls.find((call) => call.type === "writeObservationMarkdown").content.includes(
    "A failure was observed"
  ),
  true
);
assert.equal(calls.find((call) => call.type === "archiveStimuli").items, stimuli);

assert.throws(
  () => new CellMetabolismService(),
  /requires cell/
);

console.log("CellMetabolismService tests passed");
