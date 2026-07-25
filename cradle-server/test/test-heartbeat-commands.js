import assert from "assert";
import { createHeartbeatCommands, renderHeartbeatResult } from "../src/commands/heartbeat-commands.js";

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

let ticked = false;
const modeStore = {
  getMode: async () => "manual",
  setMode: async (mode) => ({
    previous: "manual",
    current: mode,
  }),
};
const proposalListCalls = [];
const proposalStore = {
  list: async ({ status }) => {
    proposalListCalls.push(status);
    return [
      {
        proposal: {
          proposalId: "proposal-001",
          status: "pending",
          action: "repair",
          sourceCellId: "cell-001",
        },
      },
    ];
  },
};

const commands = createHeartbeatCommands({
  heartbeatServiceFactory: () => ({
    beat: async () => ({
      mode: "manual",
      action: "stay",
      selected: null,
    }),
  }),
  heartbeatModeStoreFactory: () => modeStore,
  lifecycleProposalStoreFactory: () => proposalStore,
});

assert.deepEqual(
  commands.map((command) => command.name),
  ["/heartbeat", "/tick", "/heartbeat-mode", "/proposals"]
);

const byName = new Map(commands.map((command) => [command.name, command]));
assert.equal(byName.get("/heartbeat").match("/heartbeat"), true);
assert.equal(byName.get("/tick").match("/tick"), true);
assert.equal(byName.get("/heartbeat-mode").match("/heartbeat-mode automatic"), true);
assert.equal(byName.get("/proposals").match("/proposals pending"), true);

const heartbeatOutput = await captureConsoleAsync(() =>
  byName.get("/heartbeat").execute({ engine: {} })
);
assert.ok(heartbeatOutput.includes("Heartbeat completed."));
assert.ok(heartbeatOutput.includes("Action: stay"));

await byName.get("/tick").execute({
  engine: {
    tickAll: async () => {
      ticked = true;
    },
  },
});
assert.equal(ticked, true);

const currentModeOutput = await captureConsoleAsync(() =>
  byName.get("/heartbeat-mode").execute({ input: "/heartbeat-mode" })
);
assert.equal(currentModeOutput, "Heartbeat Mode: manual");

const setModeOutput = await captureConsoleAsync(() =>
  byName.get("/heartbeat-mode").execute({ input: "/heartbeat-mode automatic" })
);
assert.ok(setModeOutput.includes("Heartbeat mode changed:"));
assert.ok(setModeOutput.includes("manual → automatic"));

const invalidModeOutput = await captureConsoleAsync(() =>
  byName.get("/heartbeat-mode").execute({ input: "/heartbeat-mode invalid" })
);
assert.equal(invalidModeOutput, "Usage: /heartbeat-mode <manual|automatic>");

const proposalsOutput = await captureConsoleAsync(() =>
  byName.get("/proposals").execute({ input: "/proposals pending" })
);
assert.deepEqual(proposalListCalls, ["pending"]);
assert.ok(proposalsOutput.includes("proposal-001  pending  repair  cell-001"));

const blockedOutput = captureConsole(() => {
  renderHeartbeatResult({
    mode: "manual",
    action: "stay",
    blocked: [
      {
        proposal: {
          sourceCellId: "cell-001",
          action: "repair",
          repairType: "artifact",
        },
        policyDecision: {
          reasons: ["needs approval"],
        },
      },
    ],
  });
});
assert.ok(blockedOutput.includes("No executable proposal."));
assert.ok(blockedOutput.includes("cell-001 REPAIR / ARTIFACT"));
assert.ok(blockedOutput.includes("needs approval"));

console.log("Heartbeat command tests passed");
