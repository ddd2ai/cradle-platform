import { ApiError } from "../api/api-error.js";

export class ReadCellWorkspaceFileUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({ cellId, path }) {
    const cell = this.engine.getCell(cellId);

    if (!cell) {
      throw new ApiError({
        status: 404,
        code: "CELL_NOT_FOUND",
        message: `Cell ${cellId} was not found`,
        details: { cellId },
      });
    }

    const relativePath = String(path ?? "").trim();

    if (!relativePath) {
      throw new ApiError({
        status: 400,
        code: "WORKSPACE_FILE_PATH_REQUIRED",
        message: "Workspace file path is required",
      });
    }

    try {
      return {
        cellId,
        path: relativePath,
        content: await cell.readWorkspaceFile(relativePath),
      };
    } catch (error) {
      const message = error?.message || "";

      if (message.includes("outside cell directory")) {
        throw new ApiError({
          status: 400,
          code: "INVALID_WORKSPACE_FILE_PATH",
          message: "Workspace file path is invalid",
          details: { path: relativePath },
        });
      }

      throw new ApiError({
        status: 404,
        code: "WORKSPACE_FILE_NOT_FOUND",
        message: `Workspace file ${relativePath} was not found`,
        details: { cellId, path: relativePath },
      });
    }
  }
}
