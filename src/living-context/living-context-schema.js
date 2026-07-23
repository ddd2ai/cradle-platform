import {
  normalizeRelationships,
} from "./relationship-utils.js";

/**
 * living-context-schema.js
 *
 * Living Context 結構定義與驗證
 * Living Context 定義 Cell 的責任與邊界
 */

/**
 * 建立新的 Living Context
 *
 * @param {Object} options
 * @param {string} options.cellId - Cell ID
 * @param {string} [options.purpose=""] - 目的
 * @param {string[]} [options.responsibilities=[]] - 責任清單
 * @param {string[]} [options.owns=[]] - 擁有的資源／能力
 * @param {string[]} [options.excludes=[]] - 明確排除的責任
 * @param {string[]} [options.inputs=[]] - 輸入項目
 * @param {string[]} [options.outputs=[]] - 輸出項目
 * @param {string[]} [options.constraints=[]] - 限制條件
 * @param {Object[]} [options.relationships=[]] - 關係清單
 * @returns {Object} Living Context 物件
 */
export function createLivingContext(options = {}) {
  const normalizedCellId =
    String(options.cellId ?? "").trim();

  if (!normalizedCellId) {
    throw new Error(
      "createLivingContext: cellId is required"
    );
  }

  const now = new Date().toISOString();

  const context = normalizeLivingContext({
    id:
      options.id ??
      `living-context-${normalizedCellId}`,

    cellId: normalizedCellId,
    purpose: options.purpose ?? "",

    responsibilities:
      options.responsibilities ?? [],

    owns:
      options.owns ?? [],

    excludes:
      options.excludes ?? [],

    inputs:
      options.inputs ?? [],

    outputs:
      options.outputs ?? [],

    constraints:
      options.constraints ?? [],

    relationships:
      options.relationships ?? [],

    createdAt:
      options.createdAt ?? now,

    updatedAt:
      options.updatedAt ?? now,
  });

  const validation =
    validateLivingContext(context);

  if (!validation.valid) {
    throw new Error(
      [
        "createLivingContext: invalid Living Context",
        ...validation.errors,
      ].join("; ")
    );
  }

  return context;
}

/**
 * 正規化 Living Context
 *
 * @param {Object} context
 * @returns {Object}
 */
export function normalizeLivingContext(context) {
  if (
    !context ||
    typeof context !== "object" ||
    Array.isArray(context)
  ) {
    throw new Error(
      "normalizeLivingContext: context must be an object"
    );
  }

  const cleanStringArray = (items) => {
    if (!Array.isArray(items)) {
      return [];
    }

    const normalizedItems = items
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);

    return [...new Set(normalizedItems)];
  };

  return {
    ...context,

    id:
      typeof context.id === "string"
        ? context.id.trim()
        : "",

    cellId:
      typeof context.cellId === "string"
        ? context.cellId.trim()
        : "",

    purpose:
      typeof context.purpose === "string"
        ? context.purpose.trim()
        : "",

    responsibilities:
      cleanStringArray(
        context.responsibilities
      ),

    owns:
      cleanStringArray(context.owns),

    excludes:
      cleanStringArray(context.excludes),

    inputs:
      cleanStringArray(context.inputs),

    outputs:
      cleanStringArray(context.outputs),

    constraints:
      cleanStringArray(context.constraints),

    relationships:
      normalizeRelationships(
        context.relationships
      ),

    createdAt:
      context.createdAt ??
      new Date().toISOString(),

    updatedAt:
      context.updatedAt ??
      new Date().toISOString(),
  };
}

/**
 * 驗證 Living Context
 *
 * @param {Object} context
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateLivingContext(context) {
  const errors = [];

  if (
    !context ||
    typeof context !== "object" ||
    Array.isArray(context)
  ) {
    return {
      valid: false,
      errors: [
        "Living Context must be an object",
      ],
    };
  }

  const cellId =
    typeof context.cellId === "string"
      ? context.cellId.trim()
      : "";

  if (!cellId) {
    errors.push(
      "cellId is required and must be a non-empty string"
    );
  }

  if (
    context.id !== undefined &&
    typeof context.id !== "string"
  ) {
    errors.push("id must be a string");
  }

  if (
    context.purpose !== undefined &&
    typeof context.purpose !== "string"
  ) {
    errors.push("purpose must be a string");
  }

  const stringArrayFields = [
    "responsibilities",
    "owns",
    "excludes",
    "inputs",
    "outputs",
    "constraints",
  ];

  for (const field of stringArrayFields) {
    const value = context[field];

    if (
      value !== undefined &&
      !Array.isArray(value)
    ) {
      errors.push(`${field} must be an array`);
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item !== "string") {
          errors.push(
            `${field}[${index}] must be a string`
          );
        }
      });
    }
  }

  if (
    context.relationships !== undefined &&
    !Array.isArray(context.relationships)
  ) {
    errors.push(
      "relationships must be an array"
    );
  }

  if (Array.isArray(context.relationships)) {
    context.relationships.forEach(
      (relationship, index) => {
        if (
          !relationship ||
          typeof relationship !== "object" ||
          Array.isArray(relationship)
        ) {
          errors.push(
            `relationships[${index}] must be an object`
          );
          return;
        }

        const type =
          typeof relationship.type === "string"
            ? relationship.type.trim()
            : "";

        const target =
          typeof relationship.target === "string"
            ? relationship.target.trim()
            : "";

        if (!type) {
          errors.push(
            `relationships[${index}].type is required and must be a non-empty string`
          );
        }

        if (!target) {
          errors.push(
            `relationships[${index}].target is required and must be a non-empty string`
          );
        }
      }
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
