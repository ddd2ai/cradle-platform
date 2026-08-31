import assert from "node:assert/strict";
import {
  buildArtifactOutputIndex,
  extractDeclaredSymbols,
  hasIndexedContentTerm,
} from "../src/production/artifact-content-index.js";

const content = `
export class PaymentService {
  public calculateTotal() { return 1; }
}
export function createPayment() {}
const DEFAULT_CURRENCY = "TWD";
`;

assert.deepEqual(extractDeclaredSymbols(content), [
  "PaymentService",
  "createPayment",
  "DEFAULT_CURRENCY",
  "calculateTotal",
]);
const index = buildArtifactOutputIndex({
  content,
  indexedTerms: ["calculateTotal", "missingSymbol"],
});
assert.deepEqual(index.declaredSymbols, extractDeclaredSymbols(content));
assert.equal(index.contentBytes, Buffer.byteLength(content, "utf8"));
assert.equal(index.contentTermIndexComplete, true);
assert.equal(hasIndexedContentTerm(index, "calculateTotal"), true);
assert.equal(hasIndexedContentTerm(index, "missingSymbol"), false);

const oversizedIndex = buildArtifactOutputIndex({
  content: Array.from({ length: 65 }, (_, index) => `term_${index}`).join(" "),
  indexedTerms: Array.from({ length: 65 }, (_, index) => `term_${index}`),
});
assert.equal(oversizedIndex.contentTermHashes.length, 64);
assert.equal(oversizedIndex.contentTermIndexComplete, false);

console.log("Artifact content index tests passed");
