import path from "node:path";
import { createHash } from "node:crypto";
import { hashContentTerm } from "./artifact-content-index.js";
import { extractArtifactGoalRequirements } from "./artifact-goal-requirements.js";

const MAX_LOOKUP_KEYS = 128;

export function buildArtifactImpactTerms(output) {
  if (output?.kind !== "file" || !output.path) return [];

  const outputPath = normalizePath(output.path);
  const basename = path.posix.basename(outputPath);
  const stem = basename.replace(/\.[^.]+$/, "");
  const terms = new Set();

  for (const suffix of pathSuffixes(outputPath)) {
    terms.add(`path:${suffix}`);
  }
  terms.add(`file:${basename}`);
  if (stem.length >= 4) terms.add(`stem:${stem}`);

  for (const symbol of output.declaredSymbols ?? []) {
    const normalized = String(symbol).trim().toLowerCase();
    if (normalized.length >= 4) terms.add(`symbol:${normalized}`);
  }
  return [...terms];
}

export function buildArtifactImpactLookupKeys({ task, executionResult } = {}) {
  const evidence = [
    task?.title,
    task?.content,
    executionResult?.status,
    executionResult?.command,
    executionResult?.stderr,
    executionResult?.stdout,
    executionResult?.error,
  ].filter(Boolean).join("\n").toLowerCase();
  const keys = new Set();

  for (const match of evidence.matchAll(/[a-z0-9_$./\\-]+\.[a-z0-9]+/gi)) {
    const referencedPath = normalizePath(match[0]);
    const basename = path.posix.basename(referencedPath);
    const stem = basename.replace(/\.[^.]+$/, "");
    for (const suffix of pathSuffixes(referencedPath)) {
      keys.add(`path:${suffix}`);
    }
    keys.add(`file:${basename}`);
    if (stem.length >= 4) keys.add(`stem:${stem}`);
    if (keys.size >= MAX_LOOKUP_KEYS) return [...keys];
  }

  for (const match of evidence.matchAll(/[a-z_$][\w$]*/gi)) {
    const token = match[0].toLowerCase();
    if (token.length < 4) continue;
    keys.add(`stem:${token}`);
    keys.add(`symbol:${token}`);
    if (keys.size >= MAX_LOOKUP_KEYS) return [...keys].slice(0, MAX_LOOKUP_KEYS);
  }
  return [...keys];
}

export function hashArtifactImpactTerm(term) {
  return createHash("sha256").update(String(term)).digest("hex");
}

export function buildArtifactRepairHead(artifact) {
  const { outputs = [], ...artifactMetadata } = artifact ?? {};
  const fileOutputs = outputs.filter(
    (output) => output?.kind === "file" && output.path
  );
  const requiredTerms = requiredGoalTerms(artifact?.goal);
  return {
    ...artifactMetadata,
    outputCount: fileOutputs.length,
    singleOutputPath: fileOutputs.length === 1 ? fileOutputs[0].path : null,
    contentBytes: fileOutputs.reduce(
      (total, output) => total + outputContentBytes(output),
      0
    ),
    goalTermCoverage: buildGoalTermCoverage(fileOutputs, requiredTerms),
  };
}

export function evolveArtifactRepairHead({
  baseHead,
  artifact,
  previousOutputs = [],
  nextOutputs = artifact?.outputs ?? [],
} = {}) {
  if (!baseHead?.revision?.revisionId || !artifact?.revision?.revisionId) {
    throw new Error("Artifact repair head evolution requires base and next revisions");
  }

  const { outputs: _outputs, ...artifactMetadata } = artifact;
  const requiredTerms = requiredGoalTerms(artifact.goal);
  const coverage = { ...(baseHead.goalTermCoverage ?? {}) };
  for (const output of previousOutputs) {
    adjustGoalTermCoverage(coverage, output, requiredTerms, -1);
  }
  for (const output of nextOutputs) {
    adjustGoalTermCoverage(coverage, output, requiredTerms, 1);
  }

  return {
    ...baseHead,
    ...artifactMetadata,
    outputCount: baseHead.outputCount,
    singleOutputPath: baseHead.singleOutputPath ?? null,
    contentBytes: Math.max(
      0,
      Number(baseHead.contentBytes ?? 0) -
        previousOutputs.reduce((total, output) => total + outputContentBytes(output), 0) +
        nextOutputs.reduce((total, output) => total + outputContentBytes(output), 0)
    ),
    goalTermCoverage: coverage,
  };
}

function requiredGoalTerms(goal) {
  return extractArtifactGoalRequirements(goal)
    .filter((requirement) => requirement.required)
    .map((requirement) => requirement.term);
}

function buildGoalTermCoverage(outputs, terms) {
  const coverage = Object.fromEntries(
    terms.map((term) => [hashContentTerm(term), 0])
  );
  for (const output of outputs) {
    adjustGoalTermCoverage(coverage, output, terms, 1);
  }
  return coverage;
}

function adjustGoalTermCoverage(coverage, output, terms, delta) {
  const outputPath = String(output?.path ?? "").toLowerCase();
  const content = typeof output?.content === "string"
    ? output.content.toLowerCase()
    : null;
  const indexedHashes = new Set(output?.contentTermHashes ?? []);
  for (const term of terms) {
    const hash = hashContentTerm(term);
    const contentContainsTerm = content !== null
      ? content.includes(term)
      : indexedHashes.has(hash);
    if (
      outputPath.includes(term) ||
      contentContainsTerm
    ) {
      coverage[hash] = Math.max(0, Number(coverage[hash] ?? 0) + delta);
    }
  }
}

function outputContentBytes(output) {
  return typeof output?.content === "string"
    ? Buffer.byteLength(output.content, "utf8")
    : Number(output?.contentBytes ?? 0);
}

function pathSuffixes(value) {
  const segments = value.split("/").filter(Boolean);
  return segments.map((_, index) => segments.slice(index).join("/"));
}

function normalizePath(value) {
  return String(value)
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}
