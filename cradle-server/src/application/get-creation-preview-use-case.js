import { ApiError } from "../api/api-error.js";

const PREVIEW_FILE_NAME = "preview.png";

export class GetCreationPreviewUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({ artifactId }) {
    for (const cell of this.engine.listCells()) {
      if (!cell.artifactStore) continue;

      const cellId = cell.id;

      try {
        const summaryResult = await cell.artifactStore.listArtifactSummaries();
        const existsInCell = (summaryResult?.artifacts ?? []).some(
          (artifact) => (artifact.artifactId ?? artifact.id) === artifactId,
        );

        if (!existsInCell) continue;

        const previewPath = getArtifactPreviewPath(artifactId);
        const hasPreview = await cell.hasWorkspacePath?.(previewPath);

        if (hasPreview && cell.readWorkspaceBinaryFile) {
          return imageResponse({
            contentType: "image/png",
            body: await cell.readWorkspaceBinaryFile(previewPath),
          });
        }

        const artifact = await cell.artifactStore.readArtifact(artifactId);
        const svg = findSafeSvgPreview(artifact);
        if (svg) {
          return imageResponse({
            contentType: "image/svg+xml; charset=utf-8",
            body: Buffer.from(svg.content, "utf8"),
            svg: true,
          });
        }
      } catch {
        continue;
      }
    }

    throw new ApiError({
      status: 404,
      code: "CREATION_PREVIEW_NOT_FOUND",
      message: `Preview image was not found for Creation ${artifactId}`,
      details: { artifactId },
    });
  }
}

export function getArtifactPreviewPath(artifactId) {
  return `productions/${artifactId}/.cradle/${PREVIEW_FILE_NAME}`;
}

function findSafeSvgPreview(artifact) {
  if (artifact?.type !== "image") return null;
  const output = artifact.outputs?.find((candidate) =>
    candidate?.kind === "file" &&
    String(candidate.language).toLowerCase() === "svg" &&
    String(candidate.path).toLowerCase().endsWith(".svg")
  );
  const content = String(output?.content ?? "").trim();
  if (!/^<svg\b[\s\S]*<\/svg>$/i.test(content)) return null;
  if (/<(?:script|foreignObject)\b|\son\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:|data:)/i.test(content)) {
    return null;
  }
  return { ...output, content };
}

function imageResponse({ contentType, body, svg = false }) {
  return {
    rawResponse: true,
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(svg ? { "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } : {}),
    },
    body,
  };
}
