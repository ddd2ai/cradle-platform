import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { writeJsonFile, readJsonFile } from "../utils/json-file.js";

export const MAX_SOURCE_DOCUMENT_BYTES = 20 * 1024 * 1024;

const MEDIA_TYPES_BY_EXTENSION = new Map([
  [".txt", "text/plain"],
  [".md", "text/markdown"],
  [".markdown", "text/markdown"],
  [".csv", "text/csv"],
  [".json", "application/json"],
  [".xml", "application/xml"],
  [".html", "text/html"],
  [".htm", "text/html"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
]);

const SUPPORTED_MEDIA_TYPES = new Set(MEDIA_TYPES_BY_EXTENSION.values());

export class SourceDocumentStore {
  constructor({ sourcesDir, maxBytes = MAX_SOURCE_DOCUMENT_BYTES, now = () => new Date() } = {}) {
    if (!sourcesDir) throw new Error("SourceDocumentStore requires sourcesDir");
    this.sourcesDir = sourcesDir;
    this.maxBytes = maxBytes;
    this.now = now;
  }

  async accept({ fileName, mediaType, bytes } = {}) {
    const content = toBuffer(bytes);
    const safeName = normalizeFileName(fileName);
    const resolvedMediaType = resolveMediaType({ fileName: safeName, mediaType, bytes: content });

    if (content.length === 0) throw invalidSource("Source document is empty");
    if (content.length > this.maxBytes) {
      throw invalidSource(`Source document exceeds ${this.maxBytes} bytes`);
    }
    if (!SUPPORTED_MEDIA_TYPES.has(resolvedMediaType)) {
      throw invalidSource(`Unsupported source document media type: ${resolvedMediaType}`);
    }

    const sourceId = `source-${randomUUID()}`;
    const extension = extensionFor(safeName, resolvedMediaType);
    const storedFile = `original${extension}`;
    const finalDir = path.join(this.sourcesDir, sourceId);
    const stagingDir = path.join(this.sourcesDir, `.${sourceId}.staging`);
    const acceptedAt = this.now().toISOString();
    const source = {
      schemaVersion: 1,
      sourceId,
      originalName: safeName,
      mediaType: resolvedMediaType,
      byteLength: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
      acceptedAt,
      storedFile,
      extraction: { status: "pending", method: null, evidence: null },
    };

    await fs.mkdir(this.sourcesDir, { recursive: true });
    await fs.mkdir(stagingDir, { recursive: false });
    try {
      await fs.writeFile(path.join(stagingDir, storedFile), content, { flag: "wx" });
      await writeJsonFile(path.join(stagingDir, "source.json"), source, { dir: stagingDir });
      await fs.rename(stagingDir, finalDir);
    } catch (error) {
      await fs.rm(stagingDir, { recursive: true, force: true });
      throw error;
    }

    return source;
  }

  async read(sourceId) {
    const source = await readJsonFile(path.join(this.sourcesDir, sourceId, "source.json"), null);
    if (!source) throw new Error(`Source document not found: ${sourceId}`);
    return source;
  }

  async readBytes(sourceId) {
    const source = await this.read(sourceId);
    return await fs.readFile(path.join(this.sourcesDir, sourceId, source.storedFile));
  }

  async recordExtraction(sourceId, extraction) {
    const source = await this.read(sourceId);
    const updated = {
      ...source,
      extraction: structuredClone(extraction),
      updatedAt: this.now().toISOString(),
    };
    await writeJsonFile(path.join(this.sourcesDir, sourceId, "source.json"), updated);
    if (typeof extraction?.text === "string" && extraction.text) {
      await fs.writeFile(path.join(this.sourcesDir, sourceId, "extracted.txt"), extraction.text, "utf8");
    }
    return updated;
  }

  async recordStimulus(sourceId, stimulus) {
    const source = await this.read(sourceId);
    const updated = {
      ...source,
      stimulus: structuredClone(stimulus),
      updatedAt: this.now().toISOString(),
    };
    await writeJsonFile(path.join(this.sourcesDir, sourceId, "source.json"), updated);
    return updated;
  }
}

function toBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array) return Buffer.from(bytes);
  throw invalidSource("Source document bytes are required");
}

function normalizeFileName(value) {
  const normalized = path.basename(String(value ?? "").trim()).replace(/[\u0000-\u001f]/g, "");
  if (!normalized || normalized === "." || normalized === "..") {
    throw invalidSource("Source document file name is required");
  }
  return normalized.slice(0, 180);
}

function resolveMediaType({ fileName, mediaType, bytes }) {
  const declared = String(mediaType ?? "").split(";", 1)[0].trim().toLowerCase();
  const inferred = MEDIA_TYPES_BY_EXTENSION.get(path.extname(fileName).toLowerCase());
  const detected = detectBinaryMediaType(bytes);
  if (
    declared &&
    (declared === "application/pdf" || declared.startsWith("image/")) &&
    declared !== "image/svg+xml" &&
    !detected
  ) {
    throw invalidSource(`Source document signature does not match ${declared}`);
  }
  if (detected && declared && declared !== "application/octet-stream" && detected !== declared) {
    throw invalidSource(`Source document signature does not match ${declared}`);
  }
  return detected ?? (
    declared && declared !== "application/octet-stream" ? declared : inferred
  ) ?? "";
}

function detectBinaryMediaType(bytes) {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

function extensionFor(fileName, mediaType) {
  const existing = path.extname(fileName).toLowerCase();
  if (MEDIA_TYPES_BY_EXTENSION.get(existing) === mediaType) return existing;
  return [...MEDIA_TYPES_BY_EXTENSION].find(([, type]) => type === mediaType)?.[0] ?? ".bin";
}

function invalidSource(message) {
  const error = new Error(message);
  error.code = "INVALID_SOURCE_DOCUMENT";
  return error;
}
