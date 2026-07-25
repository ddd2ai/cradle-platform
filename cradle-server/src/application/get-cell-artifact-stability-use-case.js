import { ApiError } from "../api/api-error.js";

export class GetCellArtifactStabilityUseCase {
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

    if (!cell.stabilityStore) {
      throw new ApiError({
        status: 503,
        code: "STABILITY_STORE_UNAVAILABLE",
        message: `Stability store for cell ${cellId} is not available`,
        details: { cellId },
      });
    }

    const state = await cell.stabilityStore.getArtifactState(artifactId);

    if (!state) {
      throw new ApiError({
        status: 404,
        code: "STABILITY_STATE_NOT_FOUND",
        message: `No stability state found for artifact ${artifactId}`,
        details: { cellId, artifactId },
      });
    }

    return { cellId, artifactId, state };
  }
}
