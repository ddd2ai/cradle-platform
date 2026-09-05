import { ApiError } from "../api/api-error.js";

export class ExportCellArtifactUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({ cellId, artifactId }) {
    const cell = this.engine.getCell(cellId);

    if (!cell) {
      throw new ApiError({
        status: 404,
        code: "CELL_NOT_FOUND",
        message: `Cell ${cellId} was not found`,
        details: { cellId },
      });
    }

    try {
      await cell.artifactStore?.materializeArtifact(artifactId);
      const filename = `${artifactId}.zip`;
      const body = await cell.exportWorkspaceZip({
        rootName: artifactId,
        relativePath: `productions/${artifactId}`,
      });

      return {
        rawResponse: true,
        status: 200,
        headers: {
          "content-type": "application/zip",
          "content-disposition": `attachment; filename="${filename}"`,
          "cache-control": "no-store",
        },
        body,
      };
    } catch (error) {
      throw new ApiError({
        status: 404,
        code: "ARTIFACT_EXPORT_FAILED",
        message: `Artifact ${artifactId} export failed for Cell ${cellId}`,
        details: { cellId, artifactId, reason: error?.message ?? "unknown" },
      });
    }
  }
}
