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
  async buildOperationalContext() {
    calls.push({ type: "buildOperationalContext" });
    return "operational context";
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
  consumed: 1,
  processing: "reasoning",
  observationFile: "observations/observation.md",
});

const askCall = calls.find((call) => call.type === "askWithTimeout");
assert.ok(askCall.input.includes("cell-metabolism"));
assert.ok(askCall.input.includes("failure.md"));
assert.ok(askCall.input.includes("operational context"));
assert.equal(askCall.timeoutMs, 60_000);

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

{
  let askCount = 0;
  const passiveStimulus = {
    category: "signals",
    file: "execution-passed.md",
    content: "## Source\n\ninternal.execution\n\n## Artifact\n\nartifact-1\n\n## Status\n\npassed\n",
  };
  const passiveCell = {
    id: "cell-passive",
    observationStore: {
      async writeObservationMarkdown() {
        return "observations/passive.md";
      },
    },
    async readStimuli() {
      return [passiveStimulus];
    },
    async askWithTimeout() {
      askCount += 1;
    },
    async archiveStimuli() {},
  };

  const passiveResult = await new CellMetabolismService({ cell: passiveCell }).metabolize();
  assert.equal(passiveResult.processing, "summary-only");
  assert.equal(passiveResult.created, 0);
  assert.equal(askCount, 0);
}

{
  const prompts = [];
  const observations = [];
  const archived = [];
  const evidence = [];
  const mixedStimuli = [
    {
      category: "signals",
      file: "passive.json",
      content: "PASSIVE_SECRET_MUST_NOT_ENTER_REASONING",
      envelope: {
        schemaVersion: 1,
        stimulusId: "stim-passive",
        type: "artifact.execution.passed",
        source: "internal.execution",
        createdAt: "2026-01-01T00:00:00.000Z",
        dedupKey: "passive",
        salience: { risk: 0.05, stateImpact: 0.15, novelty: 0.2 },
        facts: { artifactId: "artifact-passive", status: "passed" },
      },
    },
    {
      category: "threats",
      file: "failure.json",
      content: "ACTIONABLE_FAILURE",
      envelope: {
        schemaVersion: 1,
        stimulusId: "stim-failure",
        type: "artifact.execution.runtime_failed",
        source: "internal.execution",
        createdAt: "2026-01-01T00:00:01.000Z",
        dedupKey: "failure",
        salience: { risk: 0.9, stateImpact: 0.85, novelty: 0.7 },
        facts: { artifactId: "artifact-failure", status: "runtime_failed" },
      },
    },
  ];
  const mixedCell = {
    id: "cell-mixed",
    async readStimuli() { return mixedStimuli; },
    observationStore: {
      async writeObservationMarkdown(content) {
        observations.push(content);
        return `observations/${observations.length}.md`;
      },
    },
    async buildOperationalContext() { return "operational context"; },
    async askWithTimeout(prompt) {
      prompts.push(prompt);
      return { text: JSON.stringify({ observation: { summary: "failure" }, tasks: [] }) };
    },
    async addTask() {},
    async archiveStimuli(items) { archived.push(...items); },
    async recordEvolutionEvidence(items) { evidence.push(...items); },
  };

  const mixedResult = await new CellMetabolismService({ cell: mixedCell }).metabolize();
  assert.equal(mixedResult.processing, "reasoning");
  assert.equal(mixedResult.summaryObservationFile, "observations/1.md");
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].includes("ACTIONABLE_FAILURE"), true);
  assert.equal(prompts[0].includes("PASSIVE_SECRET_MUST_NOT_ENTER_REASONING"), false);
  assert.equal(observations.length, 2);
  assert.equal(archived.length, 2);
  assert.deepEqual(evidence.map((item) => item.evidenceId).sort(), [
    "stim-failure",
    "stim-passive",
  ]);
}

assert.throws(
  () => new CellMetabolismService(),
  /requires cell/
);

console.log("CellMetabolismService tests passed");
