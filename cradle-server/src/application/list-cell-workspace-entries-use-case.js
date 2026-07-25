import { ApiError } from "../api/api-error.js";

export class ListCellWorkspaceEntriesUseCase {
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

    try {
      return {
        cellId,
        path: relativePath,
        entries: await cell.listWorkspaceEntries(relativePath),
      };
    } catch (error) {
      const message = error?.message || "";

      if (message.includes("outside cell directory")) {
        throw new ApiError({
          status: 400,
          code: "INVALID_WORKSPACE_PATH",
          message: "Workspace path is invalid",
          details: { path: relativePath },
        });
      }

      throw new ApiError({
        status: 404,
        code: "WORKSPACE_PATH_NOT_FOUND",
        message: `Workspace path ${relativePath || "."} was not found`,
        details: { cellId, path: relativePath },
      });
    }
  }
}
