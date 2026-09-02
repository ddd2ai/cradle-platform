const LEVELS = new Set(["info", "warn", "error"]);

/**
 * Application-facing operational activity port.
 *
 * It records lifecycle facts only: identifiers, stages and evidence outcomes.
 * Prompts, model responses, extracted document content and reasoning must never
 * be passed through this interface.
 */
export class RuntimeActivityLogger {
  constructor({ write = () => {} } = {}) {
    this.write = write;
  }

  info(scope, action, fields) {
    this.#record("info", scope, action, fields);
  }

  warn(scope, action, fields) {
    this.#record("warn", scope, action, fields);
  }

  error(scope, action, fields) {
    this.#record("error", scope, action, fields);
  }

  #record(level, scope, action, fields = {}) {
    try {
      this.write({
        level: LEVELS.has(level) ? level : "info",
        scope: normalizeToken(scope, "runtime"),
        action: normalizeToken(action, "activity"),
        fields: sanitizeFields(fields),
      });
    } catch {
      // Diagnostics must never change an authoritative lifecycle outcome.
    }
  }
}

export function formatRuntimeActivity({ scope, action, fields = {} } = {}) {
  const details = Object.entries(fields)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(" ");
  return `[${scope ?? "runtime"}] ${action ?? "activity"}${details ? ` ${details}` : ""}`;
}

function sanitizeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields ?? {})
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [normalizeToken(key, "field"), sanitizeValue(value)])
  );
}

function sanitizeValue(value) {
  if (["string", "number", "boolean"].includes(typeof value)) {
    return typeof value === "string"
      ? value.replace(/[\r\n\t]+/g, " ").slice(0, 240)
      : value;
  }
  if (Array.isArray(value)) return value.map(sanitizeValue).slice(0, 20);
  return String(value).replace(/[\r\n\t]+/g, " ").slice(0, 240);
}

function normalizeToken(value, fallback) {
  const token = String(value ?? "").trim().replace(/[^a-zA-Z0-9_.-]/g, "_");
  return token || fallback;
}

function formatValue(value) {
  if (typeof value === "string" && /^[a-zA-Z0-9_.:@/-]+$/.test(value)) return value;
  return JSON.stringify(value);
}
