import { ApiError } from "../api/api-error.js";

export class FeedCellUseCase {
  constructor({ engine }) {
    this.engine = engine;
  }

  async execute({ cellId, content }) {
    const normalizedCellId = String(cellId ?? "").trim();
    const normalizedContent = String(content ?? "").trim();

    if (!normalizedCellId || !this.engine.getCell(normalizedCellId)) {
      throw new ApiError({
        status: 404,
        code: "CELL_NOT_FOUND",
        message: `Cell ${normalizedCellId || "(missing)"} was not found`,
        details: { cellId: normalizedCellId },
      });
    }

    if (!normalizedContent) {
      throw new ApiError({
        status: 400,
        code: "INVALID_FEED_CONTENT",
        message: "Feed content is required",
        details: { cellId: normalizedCellId },
      });
    }

    const message = await this.engine.pushMessage({
      from: "user",
      to: normalizedCellId,
      type: "feed",
      content: normalizedContent,
    });

    console.log(
      `[feed] cell=${normalizedCellId} message=${message?.id ?? "unknown"} length=${normalizedContent.length}`
    );

    return {
      cellId: normalizedCellId,
      message,
    };
  }
}
