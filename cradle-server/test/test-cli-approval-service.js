import assert from "assert";
import { createCliApprovalService } from "../src/commands/cli-approval-service.js";

function captureConsoleAsync(fn) {
  const originalLog = console.log;
  const output = [];

  console.log = (...args) => output.push(args.join(" "));

  return Promise.resolve()
    .then(fn)
    .then((result) => ({ result, output: output.join("\n") }))
    .finally(() => {
      console.log = originalLog;
    });
}

function createEngine(answers) {
  const prompts = [];

  return {
    prompts,
    rl: {
      question: (prompt, resolve) => {
        prompts.push(prompt);
        resolve(answers.shift());
      },
    },
  };
}

const proposal = {
  sourceCellId: "cell-001",
  action: "repair",
  repairType: "artifact",
  artifactId: "artifact-001",
  threatId: "threat-001",
  confidence: 0.8,
  reason: "runtime failure",
};

const denied = await createCliApprovalService({ engine: {} }).requestApproval({
  proposal,
  policyDecision: { allowed: false },
  mode: "manual",
});
assert.equal(denied, false);

await assert.rejects(
  () =>
    createCliApprovalService({ engine: {} }).requestApproval({
      proposal,
      policyDecision: { allowed: true, riskLevel: "low", warnings: [] },
      mode: "manual",
    }),
  /CLI approval requires engine readline/
);

const yesEngine = createEngine(["maybe", "yes"]);
const yesCapture = await captureConsoleAsync(() =>
  createCliApprovalService({ engine: yesEngine }).requestApproval({
    proposal,
    policyDecision: { allowed: true, riskLevel: "low", warnings: [] },
    mode: "automatic",
  })
);
assert.equal(yesCapture.result, true);
assert.equal(yesEngine.prompts.length, 2);
assert.ok(yesCapture.output.includes("Please answer Yes or No."));
assert.ok(yesCapture.output.includes("Automatic mode requires approval"));
assert.ok(yesCapture.output.includes("Proposal approved."));

const noCapture = await captureConsoleAsync(() =>
  createCliApprovalService({ engine: createEngine(["n"]) }).requestApproval({
    proposal,
    policyDecision: { allowed: true, riskLevel: "medium", warnings: ["review"] },
    mode: "manual",
  })
);
assert.equal(noCapture.result, false);
assert.ok(noCapture.output.includes("Proposal rejected."));
assert.ok(noCapture.output.includes("No colony state was changed."));

console.log("CLI approval service tests passed");
