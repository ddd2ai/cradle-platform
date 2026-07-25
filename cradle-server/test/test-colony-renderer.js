import assert from "assert";
import {
  renderColonyStatus,
  renderDnaMatrix,
  renderEvolutionStatusTable,
  renderLiveWatch,
  renderWorkTable,
} from "../src/commands/colony-renderer.js";

function captureConsole(fn) {
  const originalLog = console.log;
  const originalClear = console.clear;
  const output = [];

  console.log = (...args) => output.push(args.join(" "));
  console.clear = () => output.push("[clear]");

  try {
    fn();
  } finally {
    console.log = originalLog;
    console.clear = originalClear;
  }

  return output.join("\n");
}

const work = captureConsole(() => {
  renderWorkTable([
    {
      Cell: "cell-001",
      Inbox: 1,
      Tasks: 2,
      Action: "process",
    },
  ]);
});
assert.ok(work.includes("cell-001"));
assert.ok(work.includes("process"));

const evolution = captureConsole(() => {
  renderEvolutionStatusTable([
    {
      Cell: "cell-001",
      Thoughts: 4,
      Unevolved: 1,
      Evolved: 3,
      Evolutions: 2,
      Next: 0,
      Last: "2026-07-24T10:00:00.000Z",
    },
  ]);
});
assert.ok(evolution.includes("Thoughts"));
assert.ok(evolution.includes("2026-07-24T10:00:00.000Z"));

const dna = captureConsole(() => {
  renderDnaMatrix([
    {
      Cell: "cell-001",
      "Dominant DNA": "CREATION",
      Score: "0.90",
      PER: "0.10",
      DEC: "0.20",
      DEP: "0.30",
      LEA: "0.40",
      COL: "0.50",
      CRE: "0.90",
      EVO: "0.70",
      REF: "0.80",
    },
  ]);
});
assert.ok(dna.includes("DNA Matrix"));
assert.ok(dna.includes("CREATION"));

const colony = captureConsole(() => {
  renderColonyStatus([
    {
      id: "cell-001",
      status: "active",
      maturity: {
        percent: 80,
        state: "stable",
        temporalVariance: 0.012345,
        convergence: 0.98765,
        normalizedMagnitude: 0.54321,
      },
      generation: 2,
      parent: "cell-000",
      inboxCount: 3,
      responsibilities: ["planning"],
      relationships: [
        {
          type: "depends-on",
          target: "cell-002",
        },
      ],
    },
    {
      id: "cell-003",
      maturity: {
        percent: 10,
        state: "new",
        temporalVariance: 0,
        convergence: 0,
        normalizedMagnitude: 0,
      },
      inboxCount: 0,
      responsibilities: [],
      relationships: [],
    },
  ]);
});
assert.ok(colony.includes("Cradle Colony"));
assert.ok(colony.includes("cell-001"));
assert.ok(colony.includes("maturity: 80% (stable)"));
assert.ok(colony.includes(" │   └─ planning"));
assert.ok(colony.includes("     └─ depends-on -> cell-002"));
assert.ok(colony.includes("status: unknown"));
assert.ok(colony.includes(" ├─ parent: -"));

const liveWatch = captureConsole(() => {
  renderLiveWatch({
    now: new Date("2026-07-24T10:00:00.000Z"),
    statusRows: [
      {
        Cell: "cell-001",
        Status: "active",
        Active: "yes",
        Mature: "80%",
        Life: "stay",
        State: "stable",
        Var: "0.0123",
        Conv: "0.99",
        Gen: 2,
        Inbox: 1,
      },
    ],
    workRows: [
      {
        Cell: "cell-001",
        Inbox: 1,
        Tasks: 2,
        Action: "process",
      },
    ],
    evolutionRows: [
      {
        Cell: "cell-001",
        Thoughts: 4,
        Unevolved: 1,
        Evolved: 3,
        Evolutions: 2,
        Next: 0,
      },
    ],
  });
});
assert.ok(liveWatch.includes("[clear]"));
assert.ok(liveWatch.includes("Cradle Live Watch"));
assert.ok(liveWatch.includes("Status"));
assert.ok(liveWatch.includes("Work"));
assert.ok(liveWatch.includes("Evolution"));
assert.ok(liveWatch.includes("Use /unwatch to stop live watch."));

console.log("Colony renderer tests passed");
