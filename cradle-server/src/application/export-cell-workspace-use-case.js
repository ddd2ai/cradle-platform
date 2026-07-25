import { ApiError } from "../api/api-error.js";

export class ExportCellWorkspaceUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({ cellId }) {
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
      const filename = `${cellId}-workspace.zip`;
      const body = await cell.exportWorkspaceZip({
        rootName: `${cellId}-workspace`,
      });

      return {
        rawResponse: true,
        status: 200,
        headers: {
          "content-type": "application/zip",
          "content-disposition": `attachment; filename="${filename}"`,
        },
        body,
      };
    } catch (error) {
      throw new ApiError({
        status: 404,
        code: "WORKSPACE_EXPORT_FAILED",
        message: `Workspace export failed for Cell ${cellId}`,
        details: { cellId, reason: error?.message ?? "unknown" },
      });
    }
  }
}
