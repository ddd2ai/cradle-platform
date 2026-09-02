import assert from "node:assert/strict";
import { ProviderMediaAnalyzer } from "../src/ingestion/provider-media-analyzer.js";

let askInput = null;
let cleaned = false;
const analyzer = new ProviderMediaAnalyzer({
  resolveBinding: () => ({ provider: "vision-test", model: "vision-1" }),
  providerFactory: async ({ provider, model }) => ({
    name: provider,
    model,
    capabilities: { mediaInput: true },
    ask: async (input) => {
      askInput = input;
      return JSON.stringify({
        summary: "A green circular logo on a transparent background",
        visibleText: ["CRADLE"],
        visualElements: ["green circle", "white leaf"],
        uncertainties: ["brand identity is not inferable from pixels alone"],
      });
    },
    cleanup: async () => { cleaned = true; },
  }),
});
const result = await analyzer.analyze({
  source: { originalName: "logo.png", mediaType: "image/png" },
  bytes: Buffer.from("image"),
});
assert.equal(result.status, "analyzed");
assert.equal(result.evidence.outcome, "sufficient");
assert.match(result.text, /green circular logo/);
assert.match(result.text, /CRADLE/);
assert.equal(askInput.media[0].mediaType, "image/png");
assert.equal(cleaned, true);

const unsupported = new ProviderMediaAnalyzer({
  resolveBinding: () => ({ provider: "text-only", model: "text-1" }),
  providerFactory: async () => ({ name: "text-only", model: "text-1", ask: async () => "" }),
});
const unavailable = await unsupported.analyze({
  source: { originalName: "logo.png", mediaType: "image/png" },
  bytes: Buffer.from("image"),
});
assert.equal(unavailable.evidence.outcome, "insufficient_evidence");
assert.match(unavailable.evidence.reason, /does not support image analysis/);

console.log("Provider media analyzer tests passed");
