import assert from "assert";
import { normalizeStimulusEnvelope } from "../src/situation/stimulus-envelope.js";

const envelope = normalizeStimulusEnvelope({
  category: "threats",
  source: "test",
  type: "artifact.failed",
  targetCellIds: ["cell-a", "cell-a", ""],
  facts: { artifactId: "a1" },
}, {
  idFactory: () => "stimulus-1",
  now: () => new Date("2026-08-31T00:00:00.000Z"),
});

assert.equal(envelope.schemaVersion, 1);
assert.deepEqual(envelope.targetCellIds, ["cell-a"]);
assert.equal(envelope.salience.risk, 0.9);
assert.equal(envelope.createdAt, "2026-08-31T00:00:00.000Z");
assert.throws(
  () => normalizeStimulusEnvelope({ category: "invalid" }, { idFactory: () => "x" }),
  /Invalid stimulus category/
);

console.log("Stimulus envelope tests passed");
