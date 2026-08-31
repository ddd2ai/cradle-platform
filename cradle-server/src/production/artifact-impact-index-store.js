import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  buildArtifactRepairHead,
  buildArtifactImpactTerms,
  hashArtifactImpactTerm,
} from "./artifact-impact-index.js";

const INDEX_VERSION = 3;
const LOOKUP_CONCURRENCY = 16;
const INDEX_WRITE_CONCURRENCY = 16;
const MAX_INDEX_CANDIDATES = 64;

export class ArtifactImpactIndexStore {
  constructor({ productionsDir } = {}) {
    if (!productionsDir) {
      throw new Error("ArtifactImpactIndexStore requires productionsDir");
    }
    this.productionsDir = productionsDir;
  }

  async synchronize({
    artifactId,
    previousManifest,
    manifest,
    indexOutputs = manifest?.outputs,
    artifactHead,
    completeOutputSet = true,
  } = {}) {
    try {
      const canUpdateIncrementally =
        manifest?.revision?.mode === "incremental" &&
        previousManifest?.revision?.revisionId &&
        await this.#hasRevision(
          artifactId,
          previousManifest.revision.revisionId
        );
      if (canUpdateIncrementally) {
        try {
          await this.#updateIncrementally({
            artifactId,
            previousManifest,
            manifest,
            indexOutputs,
            artifactHead,
          });
          return { updated: true, mode: "incremental" };
        } catch (error) {
          if (!completeOutputSet || !canBuildCompleteIndex(indexOutputs)) throw error;
        }
      }

      if (!completeOutputSet || !canBuildCompleteIndex(indexOutputs)) {
        throw new Error("Artifact impact index cannot rebuild from partial metadata");
      }
      await this.#rebuild({ artifactId, manifest, indexOutputs, artifactHead });
      return { updated: true, mode: "full" };
    } catch (error) {
      try {
        await this.#invalidate(artifactId);
      } catch {
        // The index is derived state. Callers will safely fall back to scanning.
      }
      return { updated: false, mode: "unavailable", error: error.message };
    }
  }

  async findCandidatePaths({ artifactId, revisionId, lookupKeys = [] } = {}) {
    const markerBefore = await this.#readMarker(artifactId);
    if (!isCurrentMarker(markerBefore, revisionId)) {
      return { available: false, paths: [], lookupCount: 0 };
    }

    const keys = [...new Set(lookupKeys)];
    const paths = new Set();
    let ambiguous = false;
    for (let offset = 0; offset < keys.length; offset += LOOKUP_CONCURRENCY) {
      const entries = await Promise.all(
        keys.slice(offset, offset + LOOKUP_CONCURRENCY).map((term) =>
          this.#readTerm(artifactId, term)
        )
      );
      for (const entry of entries) {
        for (const outputPath of entry?.paths ?? []) {
          paths.add(outputPath);
          if (paths.size > MAX_INDEX_CANDIDATES) {
            ambiguous = true;
            break;
          }
        }
        if (ambiguous) break;
      }
      if (ambiguous) break;
    }

    const markerAfter = await this.#readMarker(artifactId);
    if (!isCurrentMarker(markerAfter, revisionId)) {
      return { available: false, paths: [], lookupCount: keys.length };
    }
    if (ambiguous) {
      return {
        available: true,
        ambiguous: true,
        paths: [],
        outputs: [],
        lookupCount: keys.length,
      };
    }
    const outputs = [];
    const candidatePaths = [...paths];
    for (
      let offset = 0;
      offset < candidatePaths.length;
      offset += LOOKUP_CONCURRENCY
    ) {
      const reverseEntries = await Promise.all(
        candidatePaths
          .slice(offset, offset + LOOKUP_CONCURRENCY)
          .map((outputPath) => this.#readReverse(artifactId, outputPath))
      );
      for (const reverse of reverseEntries) {
        if (reverse?.output) outputs.push(reverse.output);
      }
    }
    const markerFinal = await this.#readMarker(artifactId);
    if (!isCurrentMarker(markerFinal, revisionId)) {
      return {
        available: false,
        paths: [],
        outputs: [],
        lookupCount: keys.length,
      };
    }
    return {
      available: true,
      ambiguous: false,
      paths: candidatePaths,
      outputs,
      lookupCount: keys.length,
    };
  }

  async readArtifactHead({ artifactId } = {}) {
    const marker = await this.#readMarker(artifactId);
    if (marker?.version !== INDEX_VERSION || !marker.artifactHead) {
      return { available: false, artifact: null };
    }
    return { available: true, artifact: marker.artifactHead };
  }

  async #rebuild({ artifactId, manifest, indexOutputs, artifactHead }) {
    const indexesDir = this.#indexesDir(artifactId);
    const impactDir = this.#impactDir(artifactId);
    const stagingDir = path.join(indexesDir, `.impact-${randomUUID()}`);
    const backupDir = path.join(indexesDir, `.impact-backup-${randomUUID()}`);
    const termsDir = path.join(stagingDir, "terms");
    const pathsDir = path.join(stagingDir, "paths");
    const pathsByTerm = new Map();

    for (const output of indexOutputs ?? []) {
      const outputTerms = buildArtifactImpactTerms(output);
      for (const term of outputTerms) {
        const paths = pathsByTerm.get(term) ?? new Set();
        paths.add(output.path);
        pathsByTerm.set(term, paths);
      }
    }

    await fs.mkdir(termsDir, { recursive: true });
    await forEachConcurrent(
      indexOutputs ?? [],
      INDEX_WRITE_CONCURRENCY,
      async (output) => {
        await this.#writeReverseAt(
          pathsDir,
          output,
          buildArtifactImpactTerms(output)
        );
      }
    );
    await forEachConcurrent(
      [...pathsByTerm],
      INDEX_WRITE_CONCURRENCY,
      async ([term, paths]) => {
        await this.#writeTermAt(termsDir, term, [...paths]);
      }
    );
    await writeJsonAtomic(path.join(stagingDir, "index.json"), {
      version: INDEX_VERSION,
      revisionId: manifest?.revision?.revisionId ?? null,
      artifactHead: artifactHead ?? buildArtifactRepairHead(manifest),
      updatedAt: new Date().toISOString(),
    });

    await fs.mkdir(indexesDir, { recursive: true });
    let movedPrevious = false;
    try {
      await fs.rename(impactDir, backupDir);
      movedPrevious = true;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    try {
      await fs.rename(stagingDir, impactDir);
    } catch (error) {
      if (movedPrevious) await fs.rename(backupDir, impactDir);
      throw error;
    }
    if (movedPrevious) {
      await fs.rm(backupDir, { recursive: true, force: true });
    }
  }

  async #updateIncrementally({
    artifactId,
    previousManifest,
    manifest,
    indexOutputs,
    artifactHead,
  }) {
    await this.#invalidate(artifactId);
    const previousByPath = outputsByPath(previousManifest?.outputs);
    const nextByPath = outputsByPath(indexOutputs);
    const changedPaths = new Set(manifest?.revision?.changedPaths ?? []);
    for (const previousPath of previousByPath.keys()) {
      if (!nextByPath.has(previousPath)) changedPaths.add(previousPath);
    }

    for (const outputPath of changedPaths) {
      const reverseEntry = await this.#readReverse(artifactId, outputPath);
      if (manifest?.revision?.baseRevisionId && !reverseEntry) {
        throw new Error(`Artifact impact reverse index missing: ${outputPath}`);
      }
      const previousTerms = new Set(reverseEntry?.terms ?? []);
      const nextTerms = new Set(
        buildArtifactImpactTerms(nextByPath.get(outputPath))
      );
      const affectedTerms = new Set([...previousTerms, ...nextTerms]);

      await forEachConcurrent(
        [...affectedTerms],
        INDEX_WRITE_CONCURRENCY,
        async (term) => {
          const entry = await this.#readTerm(artifactId, term);
          const paths = new Set(entry?.paths ?? []);
          paths.delete(outputPath);
          if (nextTerms.has(term)) paths.add(outputPath);
          await this.#writeTerm(artifactId, term, [...paths]);
        }
      );
      await this.#writeReverse(
        artifactId,
        nextByPath.get(outputPath) ?? { path: outputPath },
        [...nextTerms]
      );
    }

    await writeJsonAtomic(this.#markerFile(artifactId), {
      version: INDEX_VERSION,
      revisionId: manifest?.revision?.revisionId ?? null,
      artifactHead: artifactHead ?? buildArtifactRepairHead(manifest),
      updatedAt: new Date().toISOString(),
    });
  }

  async #hasRevision(artifactId, revisionId) {
    return isCurrentMarker(await this.#readMarker(artifactId), revisionId);
  }

  async #readMarker(artifactId) {
    return await readJson(this.#markerFile(artifactId));
  }

  async #readTerm(artifactId, term) {
    const entry = await readJson(this.#termFile(artifactId, term));
    return entry?.term === term ? entry : null;
  }

  async #readReverse(artifactId, outputPath) {
    const entry = await readJson(this.#reverseFile(artifactId, outputPath));
    return entry?.path === outputPath ? entry : null;
  }

  async #writeTerm(artifactId, term, paths) {
    const file = this.#termFile(artifactId, term);
    if (paths.length === 0) {
      try {
        await fs.unlink(file);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      return;
    }
    await writeJsonAtomic(file, { version: INDEX_VERSION, term, paths });
  }

  async #writeTermAt(termsDir, term, paths) {
    const hash = hashArtifactImpactTerm(term);
    await writeJsonAtomic(
      path.join(termsDir, hash.slice(0, 2), `${hash}.json`),
      { version: INDEX_VERSION, term, paths }
    );
  }

  async #writeReverse(artifactId, output, terms) {
    const outputPath = output?.path;
    if (!outputPath) return;
    const file = this.#reverseFile(artifactId, outputPath);
    if (terms.length === 0) {
      try {
        await fs.unlink(file);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      return;
    }
    await writeJsonAtomic(file, {
      version: INDEX_VERSION,
      path: outputPath,
      terms,
      output: toOutputMetadata(output),
    });
  }

  async #writeReverseAt(pathsDir, output, terms) {
    const outputPath = output.path;
    const hash = hashArtifactImpactTerm(`output:${outputPath}`);
    await writeJsonAtomic(
      path.join(pathsDir, hash.slice(0, 2), `${hash}.json`),
      {
        version: INDEX_VERSION,
        path: outputPath,
        terms,
        output: toOutputMetadata(output),
      }
    );
  }

  async #invalidate(artifactId) {
    try {
      await fs.unlink(this.#markerFile(artifactId));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  #indexesDir(artifactId) {
    return path.join(this.productionsDir, artifactId, "indexes");
  }

  #impactDir(artifactId) {
    return path.join(this.#indexesDir(artifactId), "impact");
  }

  #markerFile(artifactId) {
    return path.join(this.#impactDir(artifactId), "index.json");
  }

  #termFile(artifactId, term) {
    const hash = hashArtifactImpactTerm(term);
    return path.join(
      this.#impactDir(artifactId),
      "terms",
      hash.slice(0, 2),
      `${hash}.json`
    );
  }

  #reverseFile(artifactId, outputPath) {
    const hash = hashArtifactImpactTerm(`output:${outputPath}`);
    return path.join(
      this.#impactDir(artifactId),
      "paths",
      hash.slice(0, 2),
      `${hash}.json`
    );
  }
}

function outputsByPath(outputs = []) {
  return new Map(
    outputs
      .filter((output) => output?.kind === "file" && output.path)
      .map((output) => [output.path, output])
  );
}

function isCurrentMarker(marker, revisionId) {
  return marker?.version === INDEX_VERSION &&
    marker.revisionId === (revisionId ?? null);
}

function canBuildCompleteIndex(outputs = []) {
  return outputs
    .filter((output) => output?.kind === "file")
    .every((output) =>
      output.declaredSymbolsComplete === true ||
      Array.isArray(output.declaredSymbols)
    );
}

function toOutputMetadata(output) {
  const {
    content: _content,
    declaredSymbols: _declaredSymbols,
    declaredSymbolsComplete: _declaredSymbolsComplete,
    ...metadata
  } = output ?? {};
  return metadata;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const stagingFile = path.join(
    path.dirname(file),
    `.${path.basename(file)}-${randomUUID()}.tmp`
  );
  await fs.writeFile(stagingFile, JSON.stringify(value), "utf8");
  await fs.rename(stagingFile, file);
}

async function forEachConcurrent(values, concurrency, callback) {
  for (let offset = 0; offset < values.length; offset += concurrency) {
    await Promise.all(
      values.slice(offset, offset + concurrency).map(callback)
    );
  }
}
