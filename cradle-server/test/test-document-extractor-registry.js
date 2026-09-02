import assert from "node:assert/strict";
import {
  DocumentExtractorRegistry,
} from "../src/ingestion/document-extractor-registry.js";

const registry = new DocumentExtractorRegistry();
const text = await registry.extract({
  source: { mediaType: "text/plain" },
  bytes: Buffer.from("A durable stimulus"),
});
assert.equal(text.status, "extracted");
assert.equal(text.text, "A durable stimulus");
assert.equal(text.evidence.outcome, "sufficient");

const pdf = await registry.extract({
  source: { mediaType: "application/pdf" },
  bytes: buildPdf("Cradle stimulus"),
});
assert.equal(pdf.status, "extracted");
assert.match(pdf.text, /Cradle stimulus/);
assert.equal(pdf.metadata.pageCount, 1);

const png = Buffer.alloc(24);
Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
png.writeUInt32BE(640, 16);
png.writeUInt32BE(480, 20);
const image = await registry.extract({
  source: { mediaType: "image/png" },
  bytes: png,
});
assert.equal(image.status, "metadata-only");
assert.deepEqual(image.metadata, { width: 640, height: 480 });
assert.equal(image.evidence.outcome, "insufficient_evidence");

const visionRegistry = new DocumentExtractorRegistry({
  mediaAnalyzer: {
    analyze: async () => ({
      status: "analyzed",
      text: "Visual summary: A green logo",
      metadata: { provider: "vision-test", model: "vision-1" },
      evidence: { outcome: "sufficient", reason: "visual observation" },
    }),
  },
});
const analyzedImage = await visionRegistry.extract({
  source: { originalName: "logo.png", mediaType: "image/png" },
  bytes: png,
});
assert.equal(analyzedImage.status, "extracted");
assert.equal(analyzedImage.evidence.outcome, "sufficient");
assert.equal(analyzedImage.metadata.width, 640);
assert.match(analyzedImage.text, /green logo/);

const custom = new DocumentExtractorRegistry({
  extractors: [{
    name: "custom-v1",
    supports: () => true,
    extract: async () => ({ text: "custom" }),
  }],
});
assert.equal((await custom.extract({ source: {}, bytes: Buffer.alloc(1) })).method, "custom-v1");

function buildPdf(message) {
  const stream = `BT /F1 12 Tf 72 720 Td (${message}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length + 1}\n`;
  content += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    content += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(content, "ascii");
}

console.log("Document extractor registry tests passed");
