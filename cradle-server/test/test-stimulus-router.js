import assert from "assert";
import { resolveStimulusTargets } from "../src/situation/stimulus-router.js";

assert.deepEqual(resolveStimulusTargets({ targetCellIds: ["cell-a", "cell-a"] }), ["cell-a"]);
assert.deepEqual(resolveStimulusTargets({ targetCellIds: [] }), ["_global"]);
assert.deepEqual(resolveStimulusTargets(null, { fallbackTarget: "cell-owner" }), ["cell-owner"]);

console.log("Stimulus router tests passed");
