import { ApiError } from "../api/api-error.js";

export class GetCellArtifactUseCase {
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

    if (!cell.artifactStore) {
      throw new ApiError({
        status: 503,
        code: "ARTIFACT_STORE_UNAVAILABLE",
        message: `Artifact store for cell ${cellId} is not available`,
        details: { cellId },
      });
    }

    try {
      return {
        cellId,
        artifact: await cell.artifactStore.readArtifact(artifactId),
      };
    } catch {
      throw new ApiError({
        status: 404,
        code: "ARTIFACT_NOT_FOUND",
        message: `Artifact ${artifactId} was not found`,
        details: { cellId, artifactId },
      });
    }
  }
}
