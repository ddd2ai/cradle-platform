import { ApiError } from "../api/api-error.js";
import { AI_PROVIDER_OPTIONS } from "../ai/cell-ai-binding.js";

export class SetCellAiBindingUseCase {
  constructor({ engine, eventStream = null }) {
    this.engine = engine;
    this.eventStream = eventStream;
  }

  async execute({ cellId, provider, model, mode = "pinned" }) {
    const cell = this.engine.getCell(cellId);
    if (!cell) {
      throw new ApiError({
        status: 404,
        code: "CELL_NOT_FOUND",
        message: `Cell ${cellId} was not found`,
        details: { cellId },
      });
    }
    if (!cell.setAiBinding) {
      throw new ApiError({
        status: 409,
        code: "CELL_AI_BINDING_UNAVAILABLE",
        message: `Cell ${cellId} does not support independent AI binding`,
        details: { cellId },
      });
    }

    try {
      const followsDefault = mode === "default";
      const binding = await cell.setAiBinding({
        provider: followsDefault ? this.engine.provider : provider,
        model: followsDefault ? this.engine.model : model,
        mode,
      });
      const result = {
        cellId,
        binding,
        assistantLoaded: Boolean(cell.assistant),
        options: AI_PROVIDER_OPTIONS,
      };
      this.eventStream?.publish("cell.ai.updated", result);
      return result;
    } catch (error) {
      throw new ApiError({
        status: /work is running/.test(error.message) ? 409 : 400,
        code: /work is running/.test(error.message)
          ? "CELL_AI_BINDING_BUSY"
          : "INVALID_CELL_AI_BINDING",
        message: error.message,
        details: { cellId, provider, model, mode },
      });
    }
  }
}
