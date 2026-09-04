import { getArtifactPreviewPath } from "./get-creation-preview-use-case.js";

export class ListCreationsUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute() {
    const items = [];
    const errors = [];

    for (const cell of this.engine.listCells()) {
      if (!cell.artifactStore) continue;

      const cellId = cell.id;

      try {
        const summaryResult = await cell.artifactStore.listArtifactSummaries();
        const summaries = Array.isArray(summaryResult?.artifacts)
          ? summaryResult.artifacts
          : [];

        for (const summary of summaries) {
          const artifactId = summary.artifactId ?? summary.id;
          if (!artifactId) continue;

          try {
            const artifact = await cell.artifactStore.readArtifact(artifactId);
            items.push(await toCreationDto({ cell, cellId, artifact, summary }));
          } catch (error) {
            errors.push({
              cellId,
              artifactId,
              error: error.message,
            });
          }
        }

        for (const error of summaryResult?.errors ?? []) {
          errors.push({
            cellId,
            artifactId: error.artifactId ?? null,
            error: error.error ?? "Unable to read artifact summary",
          });
        }
      } catch (error) {
        errors.push({
          cellId,
          artifactId: null,
          error: error.message,
        });
      }
    }

    items.sort((left, right) =>
      String(right.updatedAt ?? right.createdAt ?? "").localeCompare(
        String(left.updatedAt ?? left.createdAt ?? ""),
      )
    );

    return { items, errors };
  }
}

async function toCreationDto({ cell, cellId, artifact, summary }) {
  const artifactId = artifact.id ?? summary.artifactId;
  const description = normalizeText(artifact.plan?.summary);
  const previewImageUrl = await resolvePreviewImageUrl({ cell, artifactId, artifact });
  const outputs = Array.isArray(artifact.outputs) ? artifact.outputs : [];
  const outputPaths = outputs
    .map((output) => output?.path)
    .filter(Boolean);
  const languages = [
    ...new Set(outputs.map((output) => output?.language).filter(Boolean)),
  ];

  return {
    id: artifactId,
    artifactId,
    name: artifact.title ?? summary.title ?? artifactId,
    title: artifact.title ?? summary.title ?? artifactId,
    originCellId: artifact.context?.cellId ?? cellId,
    type: artifact.type ?? summary.type ?? "unknown",
    status: artifact.status ?? summary.status ?? "unknown",
    stage: mapArtifactStatusToStage(artifact.status ?? summary.status),
    description,
    planSummary: description,
    summary: description,
    goal: artifact.goal ?? summary.goal ?? null,
    provider: artifact.context?.provider ?? null,
    model: artifact.context?.model ?? null,
    outputPaths,
    languages,
    notes: Array.isArray(artifact.notes) ? artifact.notes : [],
    previewImageUrl,
    previewUrl: null,
    workspaceAvailable: true,
    createdAt: artifact.createdAt ?? null,
    updatedAt: artifact.updatedAt ?? null,
  };
}

async function resolvePreviewImageUrl({ cell, artifactId, artifact }) {
  if (findSvgPreview(artifact)) {
    return `/api/v1/creations/${encodeURIComponent(artifactId)}/preview`;
  }
  if (typeof cell.hasWorkspacePath !== "function") {
    return null;
  }

  const previewPath = getArtifactPreviewPath(artifactId);
  const hasPreview = await cell.hasWorkspacePath(previewPath).catch(() => false);

  return hasPreview
    ? `/api/v1/creations/${encodeURIComponent(artifactId)}/preview`
    : null;
}

function findSvgPreview(artifact) {
  if (artifact?.type !== "image") return null;
  return artifact.outputs?.find((output) =>
    output?.kind === "file" &&
    String(output.language).toLowerCase() === "svg" &&
    String(output.path).toLowerCase().endsWith(".svg")
  ) ?? null;
}

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function mapArtifactStatusToStage(status) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "stable" || normalized === "completed" || normalized === "published") {
    return "stable";
  }

  if (normalized === "review" || normalized === "ready") {
    return "mature";
  }

  if (normalized === "running" || normalized === "evolving" || normalized === "repairing") {
    return "growing";
  }

  return "seed";
}
