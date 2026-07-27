import { ApiError } from "../api/api-error.js";

const CELL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function requireCell(engine, cellId, {
  code = "CELL_NOT_FOUND",
  label = "Cell",
} = {}) {
  const normalizedCellId = String(cellId ?? "").trim();
  const cell = normalizedCellId ? engine.getCell(normalizedCellId) : null;

  if (!cell) {
    throw new ApiError({
      status: 404,
      code,
      message: `${label} ${normalizedCellId || "(missing)"} was not found`,
      details: { cellId: normalizedCellId || null },
    });
  }

  return cell;
}

export function validateNewCellId(engine, cellId, { parentCellIds = [] } = {}) {
  const normalizedCellId = String(cellId ?? "").trim();

  if (!normalizedCellId || !CELL_ID_PATTERN.test(normalizedCellId)) {
    throw new ApiError({
      status: 400,
      code: "INVALID_CHILD_CELL_ID",
      message:
        "Child Cell ID must start with a letter or number and contain only letters, numbers, dots, hyphens, or underscores",
      details: { childCellId: normalizedCellId || null },
    });
  }

  if (
    normalizedCellId === engine.CRADLE_ID ||
    parentCellIds.includes(normalizedCellId)
  ) {
    throw new ApiError({
      status: 400,
      code: "INVALID_CHILD_CELL_ID",
      message: `Child Cell ID ${normalizedCellId} cannot be used for this operation`,
      details: { childCellId: normalizedCellId },
    });
  }

  if (engine.hasCell(normalizedCellId)) {
    throw new ApiError({
      status: 409,
      code: "CHILD_CELL_ALREADY_EXISTS",
      message: `Child Cell ID ${normalizedCellId} already exists`,
      details: { childCellId: normalizedCellId },
    });
  }

  return normalizedCellId;
}

export function mapCellOperationError(error, {
  code,
  message,
  details = {},
} = {}) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError({
    status: 422,
    code,
    message: error?.message || message,
    details,
  });
}
