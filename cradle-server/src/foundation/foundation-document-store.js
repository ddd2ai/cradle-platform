import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const FOUNDATION_DOCUMENTS = Object.freeze([
  { id: "vision", label: "Vision", fileName: "VISION.md", kind: "direction" },
  { id: "environment", label: "Environment", fileName: "ENVIRONMENT.md", kind: "direction" },
  { id: "dna-dimensions", label: "DNA Dimensions", fileName: "DNA_DEFINITION.md", kind: "dna" },
  { id: "dna-factors", label: "DNA Factors", fileName: "DNA_FACTORS.md", kind: "dna" },
]);

export class FoundationDocumentStore {
  constructor({ configDir }) {
    if (!configDir) throw new Error("FoundationDocumentStore requires configDir");
    this.configDir = configDir;
  }

  async list() {
    return await Promise.all(FOUNDATION_DOCUMENTS.map((definition) => this.read(definition.id)));
  }

  async read(documentId) {
    const definition = requireDefinition(documentId);
    const file = path.join(this.configDir, definition.fileName);
    const [content, stats] = await Promise.all([
      fs.readFile(file, "utf8"),
      fs.stat(file),
    ]);

    return {
      ...definition,
      content,
      revision: revisionFor(content),
      updatedAt: stats.mtime.toISOString(),
    };
  }

  async write(documentId, { content, expectedRevision } = {}) {
    const definition = requireDefinition(documentId);
    if (typeof content !== "string" || content.trim() === "") {
      const error = new Error("Foundation document content must not be empty.");
      error.code = "FOUNDATION_DOCUMENT_INVALID";
      throw error;
    }

    const current = await this.read(documentId);
    if (expectedRevision && expectedRevision !== current.revision) {
      const error = new Error("Foundation document changed after it was loaded.");
      error.code = "FOUNDATION_REVISION_CONFLICT";
      error.details = { expectedRevision, actualRevision: current.revision };
      throw error;
    }

    const normalized = content.endsWith("\n") ? content : `${content}\n`;
    const file = path.join(this.configDir, definition.fileName);
    const tempFile = path.join(
      this.configDir,
      `.${definition.fileName}.${process.pid}.${Date.now()}.tmp`,
    );

    try {
      await fs.writeFile(tempFile, normalized, "utf8");
      await fs.rename(tempFile, file);
    } catch (error) {
      await fs.rm(tempFile, { force: true }).catch(() => {});
      throw error;
    }

    return await this.read(documentId);
  }
}

function requireDefinition(documentId) {
  const definition = FOUNDATION_DOCUMENTS.find((item) => item.id === documentId);
  if (!definition) {
    const error = new Error(`Unknown Foundation document: ${documentId}`);
    error.code = "FOUNDATION_DOCUMENT_NOT_FOUND";
    throw error;
  }
  return definition;
}

function revisionFor(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}
