import assert from "node:assert/strict";
import { evaluateDocumentStimulus } from "../src/situation/document-stimulus-policy.js";

const low = evaluateDocumentStimulus({
  source: { sourceId: "source-low" },
  extraction: { text: "A short reference note", evidence: { outcome: "sufficient" } },
  relevance: 1,
});
assert.equal(low.decision, "summary-only");
assert.equal(low.evolveArtifact, false);

const negatedAction = evaluateDocumentStimulus({
  source: { sourceId: "source-negated" },
  extraction: {
    text: "這是一份背景參考資料，目前系統運作正常，內容僅供後續決策參考，不要求修改任何 Artifact。",
    evidence: { outcome: "sufficient" },
  },
  relevance: 1,
});
assert.equal(negatedAction.decision, "summary-only");
assert.equal(negatedAction.activate, false);
assert.equal(negatedAction.evolveArtifact, false);

const high = evaluateDocumentStimulus({
  source: { sourceId: "source-high" },
  extraction: {
    text: "Security requirement: update PaymentService and fix the failed validation.",
    evidence: { outcome: "sufficient" },
  },
  relevance: 1,
});
assert.equal(high.decision, "cultivate");
assert.equal(high.evolveArtifact, true);

const missing = evaluateDocumentStimulus({
  extraction: {
    text: "",
    evidence: { outcome: "insufficient_evidence", reason: "OCR unavailable" },
  },
  relevance: 1,
});
assert.equal(missing.decision, "needs-attention");
assert.equal(missing.reason, "OCR unavailable");

console.log("Document stimulus policy tests passed");
