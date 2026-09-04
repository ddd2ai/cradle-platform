import fs from "fs/promises";
import path from "path";
import { randomUUID } from "node:crypto";
import { writeJsonFile } from "../utils/json-file.js";
import { writeTextFile } from "../utils/text-file.js";
import { hashArtifactContent } from "./artifact-change-plan.js";
import {
  buildArtifactOutputIndex,
  buildContentTermIndexKey,
} from "./artifact-content-index.js";
import { extractArtifactGoalRequirements } from "./artifact-goal-requirements.js";
import { ArtifactImpactIndexStore } from "./artifact-impact-index-store.js";
import {
  defaultArtifactMutationCoordinator,
} from "./artifact-mutation-coordinator.js";
import {
  defaultArtifactMutationFileLease,
} from "./artifact-mutation-file-lease.js";
import {
  evaluateArtifactRevisionCompaction,
} from "./artifact-revision-compaction-policy.js";
import {
  assertArtifactMutationActor,
  bindArtifactOwner,
} from "./artifact-ownership-policy.js";

const MAX_REVISION_CHAIN_DEPTH = 256;

export class ArtifactStore {
  constructor({
    productionsDir,
    ownerCellId = null,
    impactIndexStore,
    mutationCoordinator,
    mutationLease,
    revisionCompactionPolicy,
    artifactSnapshotWriter,
    artifactCatalogStore,
  } = {}) {
    if (!productionsDir) {
      throw new Error("ArtifactStore requires productionsDir");
    }

    this.productionsDir = productionsDir;
    this.ownerCellId = ownerCellId;
    this.impactIndexStore = impactIndexStore ?? new ArtifactImpactIndexStore({
      productionsDir,
    });
    this.mutationCoordinator = mutationCoordinator ??
      defaultArtifactMutationCoordinator;
    this.mutationLease = mutationLease ?? defaultArtifactMutationFileLease;
    this.revisionCompactionPolicy = revisionCompactionPolicy ??
      evaluateArtifactRevisionCompaction;
    this.artifactSnapshotWriter = artifactSnapshotWriter ??
      writeArtifactSnapshotAtomic;
    this.artifactCatalogStore = artifactCatalogStore;
  }

  async ensureReady() {
    await fs.mkdir(this.productionsDir, { recursive: true });
  }

  resolveProductionDir(artifactId) {
    return path.join(this.productionsDir, artifactId);
  }

  async saveArtifact(artifact) {
    if (!artifact?.id) {
      throw new Error("saveArtifact requires artifact.id");
    }
    const ownedArtifact = this.#bindOwner(artifact);
    return await this.#runArtifactMutation(
      ownedArtifact.id,
      async () => await this.#saveArtifact(ownedArtifact)
    );
  }

  async #saveArtifact(artifact) {
    await this.ensureReady();

    const dir = this.resolveProductionDir(artifact.id);
    const outputsDir = path.join(dir, "outputs");
    const blobsDir = path.join(dir, "blobs");
    const revisionsDir = path.join(dir, "revisions");

    await fs.mkdir(outputsDir, { recursive: true });
    await fs.mkdir(blobsDir, { recursive: true });
    await fs.mkdir(revisionsDir, { recursive: true });

    const currentManifest = await this.#readManifest(artifact.id);
    if (currentManifest) this.#assertOwner(currentManifest);
    const revision = artifact.revision ?? {
      revisionId: `rev-${randomUUID()}`,
      baseRevisionId: currentManifest?.revision?.revisionId ?? null,
      mode: "full",
      changedPaths: (artifact.outputs ?? [])
        .filter((output) => output?.kind === "file")
        .map((output) => output.path),
      createdAt: artifact.createdAt ?? new Date().toISOString(),
    };
    if (
      currentManifest?.revision?.revisionId &&
      revision.revisionId !== currentManifest.revision.revisionId &&
      revision.baseRevisionId !== currentManifest.revision.revisionId
    ) {
      throw new Error(
        `Artifact revision is stale: expected base ${currentManifest.revision.revisionId}, received ${revision.baseRevisionId}`
      );
    }
    const persistedArtifact = { ...artifact, revision };
    const revisionId = sanitizeRevisionId(revision.revisionId);
    const savesCurrentRevisionMetadata =
      currentManifest?.revision?.revisionId === revision.revisionId;
    if (
      savesCurrentRevisionMetadata &&
      revisionContentFingerprint(currentManifest) !==
        revisionContentFingerprint(persistedArtifact)
    ) {
      throw new Error(`Artifact revision content is immutable: ${revision.revisionId}`);
    }
    if (!savesCurrentRevisionMetadata) {
      await this.#assertExistingRevisionContent(
        path.join(revisionsDir, `${revisionId}.json`),
        persistedArtifact
      );
    }
    const incrementallyChangedPaths = revision.mode === "incremental"
      ? new Set(revision.changedPaths ?? [])
      : null;
    const previousHashes = new Map(
      (currentManifest?.outputs ?? []).map((output) => [
        output.path,
        output.contentHash ?? (
          typeof output.content === "string" ? hashArtifactContent(output.content) : null
        ),
      ])
    );
    const manifestOutputs = [];
    const impactIndexOutputs = [];
    const indexedGoalTerms = extractArtifactGoalRequirements(artifact.goal)
      .filter((requirement) => requirement.required)
      .map((requirement) => requirement.term);
    const contentTermIndexKey = buildContentTermIndexKey(indexedGoalTerms);

    if (persistedArtifact.plan) {
      await writeTextFile(
        path.join(dir, "plan.md"),
        persistedArtifact.plan.markdown ?? JSON.stringify(persistedArtifact.plan, null, 2)
      );
    }

    for (const output of persistedArtifact.outputs ?? []) {
      if (output.kind !== "file") {
        manifestOutputs.push(output);
        continue;
      }

      const content = String(output.content ?? "");
      const canReuseContentHash = Boolean(
        incrementallyChangedPaths &&
        !incrementallyChangedPaths.has(output.path) &&
        output.contentHash
      );
      const contentHash = canReuseContentHash
        ? output.contentHash
        : hashArtifactContent(content);
      const hasReusableContentIndex =
        canReuseContentHash &&
        Array.isArray(output.contentTermHashes) &&
        output.contentTermIndexKey === contentTermIndexKey &&
        typeof output.contentTermIndexComplete === "boolean";
      const contentIndex = hasReusableContentIndex
        ? {
            contentBytes: output.contentBytes,
            contentTermHashes: output.contentTermHashes,
            contentTermIndexKey: output.contentTermIndexKey,
            contentTermIndexComplete: output.contentTermIndexComplete,
          }
        : typeof output.content === "string"
          ? buildArtifactOutputIndex({ content, indexedTerms: indexedGoalTerms })
          : {
              contentBytes: output.contentBytes,
              contentTermHashes: [],
              contentTermIndexKey,
              contentTermIndexComplete: false,
            };
      const blobPath = path.join(blobsDir, `${contentHash}.blob`);
      if (!canReuseContentHash) {
        await this.#writeBlobOnce(blobPath, content);
      }

      const { content: _content, ...outputMetadata } = output;
      const {
        declaredSymbols: _declaredSymbols,
        declaredSymbolsComplete: _declaredSymbolsComplete,
        ...persistedOutputMetadata
      } = outputMetadata;
      const {
        declaredSymbols,
        ...persistedContentIndex
      } = contentIndex;
      const manifestOutput = {
        ...persistedOutputMetadata,
        contentHash,
        ...persistedContentIndex,
      };
      manifestOutputs.push(manifestOutput);
      impactIndexOutputs.push({
        ...manifestOutput,
        declaredSymbols,
        declaredSymbolsComplete: Array.isArray(declaredSymbols),
      });

      if (previousHashes.get(output.path) === contentHash) continue;
      const outputPath = safeOutputPath(outputsDir, output.path);
      await writeTextFile(outputPath, output.content ?? "");
    }

    const manifest = {
      ...persistedArtifact,
      outputs: manifestOutputs,
    };
    if (!savesCurrentRevisionMetadata) {
      await this.#writeRevisionManifest(
        path.join(revisionsDir, `${revisionId}.json`),
        manifest
      );
    }

    const stagingManifest = path.join(dir, `.artifact-${randomUUID()}.json`);
    await writeJsonFile(stagingManifest, manifest, { dir });
    await fs.rename(stagingManifest, path.join(dir, "artifact.json"));
    await this.#writeCurrentRevision(dir, revision.revisionId, {
      deltaDepth: 0,
      deltaMetadataBytes: 0,
    });
    let impactIndex;
    try {
      impactIndex = await this.impactIndexStore.synchronize({
        artifactId: persistedArtifact.id,
        previousManifest: currentManifest,
        manifest,
        indexOutputs: impactIndexOutputs,
      });
    } catch (error) {
      impactIndex = {
        updated: false,
        mode: "unavailable",
        error: error.message,
      };
    }
    this.#indexCatalog(manifest, dir);

    return {
      artifactId: persistedArtifact.id,
      dir,
      revisionId: revision.revisionId,
      storageMode: "full",
      impactIndex,
    };
  }

  async saveArtifactRevision(artifact) {
    if (!artifact?.revision?.revisionId) {
      throw new Error("saveArtifactRevision requires artifact.revision.revisionId");
    }
    return await this.saveArtifact(artifact);
  }

  async saveArtifactDelta({ artifact, baseHead, nextHead } = {}) {
    if (!artifact?.id) {
      throw new Error("saveArtifactDelta requires artifact.id");
    }
    const ownedArtifact = this.#bindOwner(artifact);
    const ownedBaseHead = baseHead ? this.#bindOwner(baseHead) : baseHead;
    const ownedNextHead = nextHead ? this.#bindOwner(nextHead) : nextHead;
    return await this.#runArtifactMutation(
      ownedArtifact.id,
      async () => await this.#saveArtifactDelta({
        artifact: ownedArtifact,
        baseHead: ownedBaseHead,
        nextHead: ownedNextHead,
      })
    );
  }

  async transactArtifactMutation(artifactId, operation) {
    if (!artifactId || typeof operation !== "function") {
      throw new Error(
        "transactArtifactMutation requires artifactId and operation"
      );
    }
    return await this.#runArtifactMutation(artifactId, async () => {
      const assertArtifact = (artifact) => {
        if (artifact?.id !== artifactId) {
          throw new Error(
            `Artifact mutation transaction cannot write another artifact: ${artifact?.id}`
          );
        }
      };
      return await operation({
        readCurrentRevisionState: async () =>
          await this.#readCurrentRevisionState(artifactId),
        saveArtifact: async (artifact) => {
          assertArtifact(artifact);
          return await this.#saveArtifact(this.#bindOwner(artifact));
        },
        saveArtifactDelta: async ({ artifact, baseHead, nextHead }) => {
          assertArtifact(artifact);
          return await this.#saveArtifactDelta({
            artifact: this.#bindOwner(artifact),
            baseHead: baseHead ? this.#bindOwner(baseHead) : baseHead,
            nextHead: nextHead ? this.#bindOwner(nextHead) : nextHead,
          });
        },
      });
    });
  }

  async #saveArtifactDelta({ artifact, baseHead, nextHead } = {}) {
    await this.ensureReady();
    if (!artifact?.id || !artifact?.revision?.revisionId) {
      throw new Error("saveArtifactDelta requires an artifact revision");
    }
    if (artifact.revision.mode !== "incremental") {
      throw new Error("saveArtifactDelta requires an incremental revision");
    }
    if (
      baseHead?.revision?.revisionId !== artifact.revision.baseRevisionId ||
      nextHead?.revision?.revisionId !== artifact.revision.revisionId
    ) {
      throw new Error("saveArtifactDelta requires matching repair heads");
    }

    const dir = this.resolveProductionDir(artifact.id);
    const outputsDir = path.join(dir, "outputs");
    const blobsDir = path.join(dir, "blobs");
    const revisionsDir = path.join(dir, "revisions");
    await fs.mkdir(outputsDir, { recursive: true });
    await fs.mkdir(blobsDir, { recursive: true });
    await fs.mkdir(revisionsDir, { recursive: true });

    const currentRevision = await this.#readCurrentRevisionState(artifact.id);
    if (
      currentRevision.ownerCellId &&
      currentRevision.ownerCellId !== artifact.ownerCellId
    ) {
      assertArtifactMutationActor({
        artifact: { id: artifact.id, ownerCellId: currentRevision.ownerCellId },
        expectedOwnerCellId: artifact.ownerCellId,
      });
    }
    if (currentRevision.revisionId !== artifact.revision.baseRevisionId) {
      throw new Error(
        `Artifact revision is stale: expected base ${currentRevision.revisionId}, received ${artifact.revision.baseRevisionId}`
      );
    }

    const changedPaths = new Set(artifact.revision.changedPaths ?? []);
    const outputPaths = new Set(
      (artifact.outputs ?? [])
        .filter((output) => output?.kind === "file" && output.path)
        .map((output) => output.path)
    );
    if (
      changedPaths.size === 0 ||
      changedPaths.size !== outputPaths.size ||
      [...changedPaths].some((outputPath) => !outputPaths.has(outputPath))
    ) {
      throw new Error("Artifact delta outputs must exactly match changedPaths");
    }

    const indexedGoalTerms = extractArtifactGoalRequirements(artifact.goal)
      .filter((requirement) => requirement.required)
      .map((requirement) => requirement.term);
    const contentTermIndexKey = buildContentTermIndexKey(indexedGoalTerms);
    const manifestOutputs = [];
    const impactIndexOutputs = [];
    for (const output of artifact.outputs) {
      const content = String(output.content ?? "");
      const contentHash = hashArtifactContent(content);
      const contentIndex = buildArtifactOutputIndex({
        content,
        indexedTerms: indexedGoalTerms,
      });
      const { content: _content, ...outputMetadata } = output;
      const {
        declaredSymbols: _declaredSymbols,
        declaredSymbolsComplete: _declaredSymbolsComplete,
        ...persistedOutputMetadata
      } = outputMetadata;
      const { declaredSymbols, ...persistedContentIndex } = contentIndex;
      const manifestOutput = {
        ...persistedOutputMetadata,
        contentHash,
        ...persistedContentIndex,
        contentTermIndexKey,
      };
      manifestOutputs.push(manifestOutput);
      impactIndexOutputs.push({
        ...manifestOutput,
        declaredSymbols,
        declaredSymbolsComplete: Array.isArray(declaredSymbols),
      });
      await this.#writeBlobOnce(path.join(blobsDir, `${contentHash}.blob`), content);
      await writeTextFile(safeOutputPath(outputsDir, output.path), content);
    }

    const deltaRecord = {
      storageMode: "delta",
      artifact: stripRepairHeadMetadata(artifact),
      outputs: manifestOutputs,
      removedPaths: [],
      revision: artifact.revision,
    };
    const revisionId = sanitizeRevisionId(artifact.revision.revisionId);
    const revisionFile = path.join(revisionsDir, `${revisionId}.json`);
    await this.#assertExistingRevisionContent(revisionFile, deltaRecord);
    await this.#writeRevisionManifest(revisionFile, deltaRecord);
    const deltaRecordBytes = Buffer.byteLength(JSON.stringify(deltaRecord), "utf8");
    const deltaDepth = Number.isSafeInteger(currentRevision.deltaDepth)
      ? currentRevision.deltaDepth + 1
      : null;
    const deltaMetadataBytes = Number.isSafeInteger(
      currentRevision.deltaMetadataBytes
    )
      ? currentRevision.deltaMetadataBytes + deltaRecordBytes
      : null;
    const compactionDecision = this.revisionCompactionPolicy({
      deltaDepth,
      deltaMetadataBytes,
    });
    await this.#writeCurrentRevision(dir, artifact.revision.revisionId, {
      deltaDepth,
      deltaMetadataBytes,
    });

    let impactIndex;
    try {
      impactIndex = await this.impactIndexStore.synchronize({
        artifactId: artifact.id,
        previousManifest: baseHead,
        manifest: { ...stripRepairHeadMetadata(artifact), outputs: manifestOutputs },
        indexOutputs: impactIndexOutputs,
        artifactHead: nextHead,
        completeOutputSet: false,
      });
    } catch (error) {
      impactIndex = {
        updated: false,
        mode: "unavailable",
        error: error.message,
      };
    }

    let compaction = {
      performed: false,
      recommended: compactionDecision.shouldCompact,
      reason: compactionDecision.reason,
      deltaDepth,
      deltaMetadataBytes,
    };
    if (compactionDecision.shouldCompact) {
      try {
        await this.#compactCurrentRevision({
          artifactId: artifact.id,
          revisionId: artifact.revision.revisionId,
        });
        compaction = { ...compaction, performed: true };
      } catch (error) {
        compaction = { ...compaction, error: error.message };
      }
    }

    this.#indexCatalog({ ...stripRepairHeadMetadata(artifact), outputs: manifestOutputs }, dir);

    return {
      artifactId: artifact.id,
      dir,
      revisionId: artifact.revision.revisionId,
      storageMode: "delta",
      impactIndex,
      compaction,
    };
  }

  #indexCatalog(manifest, dir) {
    try {
      this.artifactCatalogStore?.upsertManifest({ manifest, storageDir: dir });
    } catch {
      // Catalog is derived metadata; filesystem Artifact remains authoritative.
    }
  }

  async readArtifact(artifactId) {
    const manifest = await this.#readManifest(artifactId);
    if (!manifest) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }
    return await this.#hydrateArtifact(artifactId, manifest);
  }

  async readArtifactManifest(artifactId) {
    const manifest = await this.#readManifest(artifactId);
    if (!manifest) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }
    return manifest;
  }

  async readArtifactRepairContext(artifactId) {
    try {
      const indexed = await this.impactIndexStore.readArtifactHead({ artifactId });
      if (indexed?.available && indexed.artifact) {
        return { artifact: indexed.artifact, mode: "head" };
      }
    } catch {
      // The repair head is derived state; fall back to the authoritative manifest.
    }
    return {
      artifact: await this.readArtifactManifest(artifactId),
      mode: "manifest-fallback",
    };
  }

  async readArtifactOutputs(artifactId, outputPaths, { manifest } = {}) {
    const sourceManifest = manifest ?? await this.readArtifactManifest(artifactId);
    const requestedPaths = [...new Set(outputPaths ?? [])];
    const outputByPath = new Map(
      (sourceManifest.outputs ?? [])
        .filter((output) => output?.kind === "file" && output.path)
        .map((output) => [output.path, output])
    );

    for (const outputPath of requestedPaths) {
      if (!outputByPath.has(outputPath)) {
        throw new Error(`Artifact output not found: ${artifactId}/${outputPath}`);
      }
    }

    const outputs = [];
    for (const outputPath of requestedPaths) {
      outputs.push(
        await this.#hydrateOutput(artifactId, outputByPath.get(outputPath))
      );
    }
    return outputs;
  }

  async findArtifactImpactCandidates(
    artifactId,
    lookupKeys,
    { revisionId } = {}
  ) {
    try {
      return await this.impactIndexStore.findCandidatePaths({
        artifactId,
        revisionId,
        lookupKeys,
      });
    } catch {
      return { available: false, paths: [], outputs: [], lookupCount: 0 };
    }
  }

  async readArtifactRevision(artifactId, revisionId) {
    const manifest = await this.#resolveRevisionManifest(artifactId, revisionId);
    return await this.#hydrateArtifact(artifactId, manifest);
  }

  async restoreArtifactRevision(artifactId, revisionId) {
    const current = await this.readArtifact(artifactId);
    const restored = await this.readArtifactRevision(artifactId, revisionId);
    const now = new Date().toISOString();
    const next = {
      ...restored,
      revision: {
        revisionId: `rev-${randomUUID()}`,
        baseRevisionId: current.revision?.revisionId ?? null,
        mode: "rollback",
        restoredRevisionId: revisionId,
        changedPaths: restored.outputs
          .filter((output) => output?.kind === "file")
          .map((output) => output.path),
        createdAt: now,
      },
      updatedAt: now,
    };
    await this.saveArtifactRevision(next);
    return next;
  }

  async listArtifacts() {
    await this.ensureReady();

    const entries = await fs.readdir(this.productionsDir, {
      withFileTypes: true,
    });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  }

  /**
   * 列出所有 Artifacts 的摘要 (只有 metadata，不載入完整內容)
   * 
   * @returns {Promise<Object>} { artifacts: [...], errors: [...] }
   */
  async listArtifactSummaries() {
    const artifactIds = await this.listArtifacts();
    const artifacts = [];
    const errors = [];

    for (const artifactId of artifactIds) {
      try {
        const artifact = await this.readArtifactManifest(artifactId);

        // 只保留 metadata，不包含 outputs 的 content
        const summary = {
          artifactId: artifact.id,
          ownerCellId: artifact.ownerCellId ?? artifact.context?.cellId ?? null,
          type: artifact.type,
          title: artifact.title,
          goal: artifact.goal,
          status: artifact.status,
          outputPaths: artifact.outputs
            ? artifact.outputs.map(o => o.path).filter(Boolean)
            : [],
          languages: artifact.languages || [],
          notes: artifact.notes || ""
        };

        artifacts.push(summary);
      } catch (error) {
        // 單一 Artifact 損壞時記錄錯誤，不中斷整個流程
        errors.push({
          artifactId,
          error: error.message
        });
      }
    }

    return { artifacts, errors };
  }

  /**
   * 讀取多個 Artifacts
   * 
   * @param {string[]} artifactIds - Artifact IDs
   * @returns {Promise<Array>} Artifacts
   */
  async readArtifacts(artifactIds = []) {
    const artifacts = [];

    for (const artifactId of artifactIds) {
      try {
        const artifact = await this.readArtifact(artifactId);
        artifacts.push(artifact);
      } catch (error) {
        console.warn(`readArtifacts: Failed to read ${artifactId}:`, error.message);
        // 繼續讀取其他 artifacts
      }
    }

    return artifacts;
  }

  async #readManifest(artifactId) {
    try {
      const dir = this.resolveProductionDir(artifactId);
      const baseManifest = JSON.parse(await fs.readFile(
        path.join(dir, "artifact.json"),
        "utf8"
      ));
      const pointer = await readJsonIfExists(path.join(dir, "current.json"));
      if (
        !pointer?.revisionId ||
        pointer.revisionId === baseManifest.revision?.revisionId
      ) {
        return baseManifest;
      }
      return await this.#resolveRevisionManifest(
        artifactId,
        pointer.revisionId,
        { baseManifest }
      );
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async #resolveRevisionManifest(artifactId, revisionId, { baseManifest } = {}) {
    const base = baseManifest ?? await readJsonIfExists(path.join(
      this.resolveProductionDir(artifactId),
      "artifact.json"
    ));
    const deltas = [];
    const visited = new Set();
    let currentRevisionId = revisionId;
    let resolvedBase = null;

    for (let depth = 0; depth < MAX_REVISION_CHAIN_DEPTH; depth += 1) {
      if (!currentRevisionId || visited.has(currentRevisionId)) {
        throw new Error(`Artifact revision chain is invalid: ${revisionId}`);
      }
      visited.add(currentRevisionId);
      if (base?.revision?.revisionId === currentRevisionId) {
        resolvedBase = base;
        break;
      }
      const record = await this.#readRevisionRecord(artifactId, currentRevisionId);
      if (record.storageMode !== "delta") {
        resolvedBase = record;
        break;
      }
      deltas.push(record);
      currentRevisionId = record.revision?.baseRevisionId;
    }
    if (!resolvedBase) {
      throw new Error(`Artifact revision chain exceeds ${MAX_REVISION_CHAIN_DEPTH}`);
    }

    const outputsByPath = new Map(
      (resolvedBase.outputs ?? []).map((output) => [output.path, output])
    );
    let manifest = { ...resolvedBase };
    for (const delta of deltas.reverse()) {
      for (const removedPath of delta.removedPaths ?? []) {
        outputsByPath.delete(removedPath);
      }
      for (const output of delta.outputs ?? []) {
        outputsByPath.set(output.path, output);
      }
      manifest = {
        ...manifest,
        ...(delta.artifact ?? {}),
        revision: delta.revision,
      };
    }
    return { ...manifest, outputs: [...outputsByPath.values()] };
  }

  async #readRevisionRecord(artifactId, revisionId) {
    const file = path.join(
      this.resolveProductionDir(artifactId),
      "revisions",
      `${sanitizeRevisionId(revisionId)}.json`
    );
    return JSON.parse(await fs.readFile(file, "utf8"));
  }

  async #readCurrentRevisionState(artifactId) {
    const dir = this.resolveProductionDir(artifactId);
    const pointer = await readJsonIfExists(path.join(dir, "current.json"));
    if (pointer?.revisionId) {
      return {
        revisionId: pointer.revisionId,
        ownerCellId: pointer.ownerCellId ?? this.ownerCellId,
        deltaDepth: Number.isSafeInteger(pointer.deltaDepth)
          ? pointer.deltaDepth
          : null,
        deltaMetadataBytes: Number.isSafeInteger(pointer.deltaMetadataBytes)
          ? pointer.deltaMetadataBytes
          : null,
      };
    }
    const base = await readJsonIfExists(path.join(dir, "artifact.json"));
    return {
      revisionId: base?.revision?.revisionId ?? null,
      ownerCellId: base?.ownerCellId ?? base?.context?.cellId ?? this.ownerCellId,
      deltaDepth: 0,
      deltaMetadataBytes: 0,
    };
  }

  async #runArtifactMutation(artifactId, operation) {
    const artifactDir = this.resolveProductionDir(artifactId);
    return await this.mutationCoordinator.runExclusive(
      artifactDir,
      async () => await this.mutationLease.runExclusive(
        artifactDir,
        async (mutationLease) => ({
          ...await operation(),
          mutationLease,
        })
      )
    );
  }

  async #writeCurrentRevision(
    dir,
    revisionId,
    { deltaDepth = 0, deltaMetadataBytes = 0 } = {}
  ) {
    const target = path.join(dir, "current.json");
    const staging = path.join(dir, `.current-${randomUUID()}.json`);
    await writeJsonFile(staging, {
      schemaVersion: 3,
      revisionId,
      ...(this.ownerCellId ? { ownerCellId: this.ownerCellId } : {}),
      deltaDepth,
      deltaMetadataBytes,
    }, { dir });
    await fs.rename(staging, target);
  }

  async #compactCurrentRevision({ artifactId, revisionId }) {
    const dir = this.resolveProductionDir(artifactId);
    const manifest = await this.#resolveRevisionManifest(artifactId, revisionId);
    await this.artifactSnapshotWriter({ dir, manifest });
    await this.#writeCurrentRevision(dir, revisionId, {
      deltaDepth: 0,
      deltaMetadataBytes: 0,
    });
  }

  async #hydrateArtifact(artifactId, manifest) {
    const outputs = [];
    for (const output of manifest.outputs ?? []) {
      outputs.push(await this.#hydrateOutput(artifactId, output));
    }
    return { ...manifest, outputs };
  }

  async #hydrateOutput(artifactId, output) {
    if (output?.kind !== "file" || typeof output.content === "string") {
      return output;
    }

    const dir = this.resolveProductionDir(artifactId);
    const content = output.contentHash
      ? await fs.readFile(
          path.join(dir, "blobs", `${output.contentHash}.blob`),
          "utf8"
        )
      : await fs.readFile(
          safeOutputPath(path.join(dir, "outputs"), output.path),
          "utf8"
        );
    return { ...output, content };
  }

  async #writeBlobOnce(file, content) {
    try {
      await fs.writeFile(file, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }

  #bindOwner(artifact) {
    return bindArtifactOwner(artifact, this.ownerCellId);
  }

  #assertOwner(artifact) {
    assertArtifactMutationActor({
      artifact,
      expectedOwnerCellId: this.ownerCellId,
      actorCellId: this.ownerCellId,
    });
  }

  async #writeRevisionManifest(file, value) {
    try {
      await fs.writeFile(file, JSON.stringify(value, null, 2), {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const existing = JSON.parse(await fs.readFile(file, "utf8"));
      if (revisionContentFingerprint(existing) !== revisionContentFingerprint(value)) {
        throw new Error(`Artifact revision content is immutable: ${value.revision?.revisionId}`);
      }
    }
  }

  async #assertExistingRevisionContent(file, value) {
    try {
      const existing = JSON.parse(await fs.readFile(file, "utf8"));
      if (revisionContentFingerprint(existing) !== revisionContentFingerprint(value)) {
        throw new Error(`Artifact revision content is immutable: ${value.revision?.revisionId}`);
      }
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

function revisionContentFingerprint(manifest) {
  return JSON.stringify({
    storageMode: manifest.storageMode ?? "full",
    baseRevisionId: manifest.revision?.baseRevisionId ?? null,
    removedPaths: manifest.removedPaths ?? [],
    outputs: (manifest.outputs ?? []).map((output) => ({
      kind: output?.kind,
      path: output?.path,
      contentHash: typeof output?.content === "string"
        ? hashArtifactContent(output.content)
        : output?.contentHash ?? null,
    })),
  });
}

function stripRepairHeadMetadata(artifact) {
  const {
    outputs: _outputs,
    outputCount: _outputCount,
    singleOutputPath: _singleOutputPath,
    contentBytes: _contentBytes,
    goalTermCoverage: _goalTermCoverage,
    ...metadata
  } = artifact ?? {};
  return metadata;
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeArtifactSnapshotAtomic({ dir, manifest }) {
  const staging = path.join(dir, `.artifact-compact-${randomUUID()}.json`);
  try {
    await writeJsonFile(staging, manifest, { dir });
    await fs.rename(staging, path.join(dir, "artifact.json"));
  } finally {
    try {
      await fs.unlink(staging);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function safeOutputPath(outputsDir, outputPath) {
  const root = path.resolve(outputsDir);
  const target = path.resolve(root, outputPath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Output path escapes artifact directory: ${outputPath}`);
  }
  return target;
}

function sanitizeRevisionId(revisionId) {
  const value = String(revisionId ?? "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!value) throw new Error("Artifact revision id is required");
  return value;
}
