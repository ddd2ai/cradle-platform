export const STIMULUS_SCHEMA_VERSION = 1;

export function normalizeStimulusEnvelope(input = {}, { idFactory, now = () => new Date() } = {}) {
  const category = normalizeCategory(input.category);
  const createdAt = input.createdAt ?? now().toISOString();
  const targetCellIds = uniqueStrings(input.targetCellIds ?? []);
  const facts = isObject(input.facts) ? input.facts : {};
  const type = String(input.type ?? defaultType(category));
  const source = String(input.source ?? "unknown");
  const stimulusId = String(input.stimulusId ?? idFactory?.() ?? "");

  if (!stimulusId) throw new Error("StimulusEnvelope requires stimulusId");

  return {
    schemaVersion: STIMULUS_SCHEMA_VERSION,
    stimulusId,
    type,
    category,
    source,
    targetCellIds,
    causationId: nullableString(input.causationId),
    correlationId: nullableString(input.correlationId),
    dedupKey: String(
      input.dedupKey ?? `${source}:${type}:${JSON.stringify(facts)}:${input.summary ?? input.content ?? ""}`
    ),
    createdAt,
    salience: normalizeSalience(input.salience, category),
    summary: String(input.summary ?? ""),
    facts,
    content: String(input.content ?? ""),
  };
}

function normalizeCategory(category) {
  const value = String(category ?? "signals");
  if (!["signals", "threats", "pressures", "resources"].includes(value)) {
    throw new Error(`Invalid stimulus category: ${value}`);
  }
  return value;
}

function normalizeSalience(value, category) {
  const defaults = category === "threats"
    ? { risk: 0.9, novelty: 0.6, stateImpact: 0.8, urgency: 0.8 }
    : { risk: 0.1, novelty: 0.5, stateImpact: 0.3, urgency: 0.3 };
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, clamp(value?.[key] ?? fallback)])
  );
}

function defaultType(category) {
  return `${category.slice(0, -1)}.observed`;
}

function uniqueStrings(values) {
  return [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))];
}

function nullableString(value) {
  return value == null || value === "" ? null : String(value);
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
