import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  SourceDocumentStore,
} from "../src/ingestion/source-document-store.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-source-store-"));
try {
  const store = new SourceDocumentStore({
    sourcesDir: root,
    now: () => new Date("2026-09-02T10:00:00.000Z"),
  });
  const source = await store.accept({
    fileName: "../brief.md",
    mediaType: "text/markdown; charset=utf-8",
    bytes: Buffer.from("# Brief\n\nGrow safely."),
  });
  assert.equal(source.originalName, "brief.md");
  assert.equal(source.mediaType, "text/markdown");
  assert.equal(source.acceptedAt, "2026-09-02T10:00:00.000Z");
  assert.equal((await store.readBytes(source.sourceId)).toString(), "# Brief\n\nGrow safely.");

  const updated = await store.recordExtraction(source.sourceId, {
    status: "extracted",
    method: "test",
    text: "Grow safely.",
    evidence: { outcome: "sufficient" },
  });
  assert.equal(updated.extraction.status, "extracted");
  assert.equal(
    await fs.readFile(path.join(root, source.sourceId, "extracted.txt"), "utf8"),
    "Grow safely.",
  );
  await store.recordStimulus(source.sourceId, {
    stimulusId: "stim-source-1",
    type: "document.accepted",
  });
  assert.equal((await store.read(source.sourceId)).stimulus.stimulusId, "stim-source-1");

  await assert.rejects(
    () => store.accept({
      fileName: "fake.pdf",
      mediaType: "application/pdf",
      bytes: Buffer.from("not a pdf"),
    }),
    /signature does not match|Source document/,
  );
  await assert.rejects(
    () => store.accept({
      fileName: "archive.zip",
      mediaType: "application/zip",
      bytes: Buffer.from("zip"),
    }),
    /Unsupported source document/,
  );
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("Source document store tests passed");
