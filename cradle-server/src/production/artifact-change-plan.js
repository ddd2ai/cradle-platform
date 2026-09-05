import { createHash, randomUUID } from "node:crypto";

const MAX_CHANGED_FILES = 3;
const MAX_REPLACEMENTS_PER_FILE = 8;

export function hashArtifactContent(content = "") {
  return createHash("sha256").update(String(content)).digest("hex");
}

export function createArtifactChangePlan({
  artifact,
  proposal,
  allowedPaths = [],
  idFactory = () => `change-${randomUUID()}`,
  revisionIdFactory = () => `rev-${randomUUID()}`,
  now = () => new Date(),
  provenance = null,
} = {}) {
  if (!artifact?.id) {
    throw new Error("ArtifactChangePlan requires artifact");
  }

  const outputByPath = new Map(
    (artifact.outputs ?? [])
      .filter((output) => output?.kind === "file" && output.path)
      .map((output) => [output.path, output])
  );
  const allowed = new Set(allowedPaths);
  const rawChanges = Array.isArray(proposal?.changes) ? proposal.changes : [];

  if (rawChanges.length === 0) {
    throw new Error("ArtifactChangePlan requires at least one change");
  }
  if (rawChanges.length > MAX_CHANGED_FILES) {
    throw new Error(`ArtifactChangePlan exceeds ${MAX_CHANGED_FILES} changed files`);
  }

  const seenPaths = new Set();
  const changes = rawChanges.map((rawChange) => {
    const path = String(rawChange?.path ?? "").trim();
    if (!allowed.has(path) && !allowed.has("*")) {
      throw new Error(`ArtifactChangePlan path is outside allowed impact: ${path}`);
    }
    assertOutputPath(path);
    if (seenPaths.has(path)) {
      throw new Error(`ArtifactChangePlan contains duplicate path: ${path}`);
    }
    seenPaths.add(path);

    const output = outputByPath.get(path);
    const isNewOutput = !output;

    const rawReplacements = Array.isArray(rawChange.replacements)
      ? rawChange.replacements
      : [];
    if (isNewOutput && typeof rawChange.content !== "string") {
      throw new Error(`ArtifactChangePlan new output requires content: ${path}`);
    }
    if (!isNewOutput && rawReplacements.length === 0) {
      throw new Error(`ArtifactChangePlan requires replacements: ${path}`);
    }
    if (rawReplacements.length > MAX_REPLACEMENTS_PER_FILE) {
      throw new Error(
        `ArtifactChangePlan exceeds ${MAX_REPLACEMENTS_PER_FILE} replacements: ${path}`
      );
    }

    let candidate = isNewOutput ? rawChange.content : String(output.content ?? "");
    const replacements = rawReplacements.map((replacement, index) => {
      const before = String(replacement?.before ?? "");
      const after = String(replacement?.after ?? "");
      if (!before) {
        throw new Error(`ArtifactChangePlan replacement before is empty: ${path}#${index}`);
      }
      if (before === after) {
        throw new Error(`ArtifactChangePlan replacement is a no-op: ${path}#${index}`);
      }

      const occurrences = countOccurrences(candidate, before);
      if (occurrences !== 1) {
        throw new Error(
          `ArtifactChangePlan replacement must match exactly once: ${path}#${index} matched ${occurrences}`
        );
      }
      candidate = candidate.replace(before, after);
      return { before, after };
    });

    return {
      path,
      ...(isNewOutput ? { newOutput: true } : { baseContentHash: hashArtifactContent(output.content) }),
      resultContentHash: hashArtifactContent(candidate),
      replacements,
      ...(isNewOutput ? { content: candidate, language: rawChange.language } : {}),
    };
  });

  return {
    schemaVersion: 1,
    changePlanId: idFactory(),
    artifactId: artifact.id,
    baseRevisionId: artifact.revision?.revisionId ?? null,
    revisionId: revisionIdFactory(),
    summary: String(proposal?.summary ?? "Incremental artifact repair").trim(),
    createdAt: now().toISOString(),
    changes,
    ...(provenance ? { provenance: structuredClone(provenance) } : {}),
  };
}

export function applyArtifactChangePlan({ artifact, changePlan } = {}) {
  if (!artifact?.id || artifact.id !== changePlan?.artifactId) {
    throw new Error("ArtifactChangePlan artifact does not match base artifact");
  }
  if (
    changePlan.baseRevisionId !== null &&
    changePlan.baseRevisionId !== (artifact.revision?.revisionId ?? null)
  ) {
    throw new Error("ArtifactChangePlan base revision is stale");
  }

  const changesByPath = new Map(changePlan.changes.map((change) => [change.path, change]));
  const changedPaths = [];
  const outputs = (artifact.outputs ?? []).map((output) => {
    const change = changesByPath.get(output.path);
    if (!change) return { ...output };

    let content = String(output.content ?? "");
    if (hashArtifactContent(content) !== change.baseContentHash) {
      throw new Error(`ArtifactChangePlan content hash is stale: ${output.path}`);
    }
    for (const replacement of change.replacements) {
      if (countOccurrences(content, replacement.before) !== 1) {
        throw new Error(`ArtifactChangePlan replacement is no longer unique: ${output.path}`);
      }
      content = content.replace(replacement.before, replacement.after);
    }
    if (hashArtifactContent(content) !== change.resultContentHash) {
      throw new Error(`ArtifactChangePlan result hash mismatch: ${output.path}`);
    }
    changedPaths.push(output.path);
    return { ...output, content };
  });

  for (const change of changePlan.changes) {
    if (!change.newOutput) continue;
    outputs.push({
      kind: "file",
      path: change.path,
      language: change.language || inferLanguage(change.path),
      content: change.content,
    });
    changedPaths.push(change.path);
  }

  if (changedPaths.length !== changePlan.changes.length) {
    throw new Error("ArtifactChangePlan did not apply every change");
  }

  const evolutionRecord = changePlan.provenance
    ? {
        ...structuredClone(changePlan.provenance),
        changePlanId: changePlan.changePlanId,
        revisionId: changePlan.revisionId,
        changedPaths,
        recordedAt: changePlan.createdAt,
      }
    : null;
  return {
    ...artifact,
    outputs,
    notes: [
      ...(artifact.notes ?? []),
      `Incremental repair: ${changePlan.summary}`,
    ],
    revision: {
      revisionId: changePlan.revisionId,
      baseRevisionId: changePlan.baseRevisionId,
      mode: "incremental",
      changePlanId: changePlan.changePlanId,
      changedPaths,
      createdAt: changePlan.createdAt,
      ...(changePlan.provenance ? { provenance: structuredClone(changePlan.provenance) } : {}),
    },
    ...(evolutionRecord ? {
      evolutionHistory: [...(artifact.evolutionHistory ?? []), evolutionRecord],
    } : {}),
    updatedAt: changePlan.createdAt,
  };
}

function countOccurrences(content, needle) {
  let count = 0;
  let offset = 0;
  while (offset <= content.length) {
    const found = content.indexOf(needle, offset);
    if (found === -1) break;
    count += 1;
    offset = found + needle.length;
  }
  return count;
}

function assertOutputPath(outputPath) {
  if (!outputPath || outputPath.startsWith("/") || outputPath.split("/").includes("..")) {
    throw new Error(`ArtifactChangePlan output path is invalid: ${outputPath}`);
  }
}

function inferLanguage(filePath) {
  const extension = String(filePath).toLowerCase().split(".").pop();
  return { java: "java", js: "javascript", ts: "typescript", py: "python", go: "go", rs: "rust" }[extension] ?? "text";
}
