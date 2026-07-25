export const DNA_DIMENSION_ORDER = [
  "PERCEPTION",
  "DECISION",
  "DECOMPOSITION",
  "LEARNING",
  "COLLABORATION",
  "CREATION",
  "EVOLUTION",
  "REFLECTION",
];

export function mapDnaDimensions(vector = {}) {
  return DNA_DIMENSION_ORDER
    .map((name) => ({
      name,
      value: resolveDimensionValue(vector[name]),
    }))
    .filter((dimension) => typeof dimension.value === "number");
}

function resolveDimensionValue(value) {
  if (typeof value === "number") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (typeof value.fitness === "number") {
    return value.fitness;
  }

  if (typeof value.strength === "number") {
    return value.strength;
  }

  const numericValues = Object.values(value)
    .filter((item) => typeof item === "number");

  if (numericValues.length === 0) {
    return null;
  }

  return numericValues.reduce((sum, item) => sum + item, 0) / numericValues.length;
}
