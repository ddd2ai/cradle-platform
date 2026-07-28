import { ApiError } from "../api/api-error.js";

const PREVIEW_FILE_NAME = "preview.png";

export class GetCreationPreviewUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({ artifactId }) {
    for (const cell of this.engine.listCells()) {
      if (!cell.artifactStore || !cell.readWorkspaceBinaryFile) continue;

      const cellId = cell.id;

      try {
        const summaryResult = await cell.artifactStore.listArtifactSummaries();
        const existsInCell = (summaryResult?.artifacts ?? []).some(
          (artifact) => (artifact.artifactId ?? artifact.id) === artifactId,
        );

        if (!existsInCell) continue;

        const previewPath = getArtifactPreviewPath(artifactId);
        const hasPreview = await cell.hasWorkspacePath?.(previewPath);

        if (!hasPreview) continue;

        return {
          rawResponse: true,
          status: 200,
          headers: {
            "content-type": "image/png",
            "cache-control": "no-store",
          },
          body: await cell.readWorkspaceBinaryFile(previewPath),
        };
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
