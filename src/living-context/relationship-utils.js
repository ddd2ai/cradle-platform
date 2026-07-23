export function deduplicateRelationships(relationships = []) {
  const seen = new Set();
  const result = [];

  for (const relationship of relationships) {
    const key = relationshipKey(relationship);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(relationship);
  }

  return result;
}

export function normalizeRelationships(relationships) {
  if (!Array.isArray(relationships)) {
    return [];
  }

  const normalizedRelationships =
    relationships
      .filter(
        (relationship) =>
          relationship &&
          typeof relationship === "object" &&
          !Array.isArray(relationship)
      )
      .map((relationship) => ({
        ...relationship,

        type:
          typeof relationship.type === "string"
            ? relationship.type.trim()
            : "",

        target:
          typeof relationship.target === "string"
            ? relationship.target.trim()
            : "",
      }))
      .filter(
        (relationship) =>
          relationship.type &&
          relationship.target
      );

  return deduplicateRelationships(normalizedRelationships);
}

function relationshipKey(relationship) {
  return `${relationship.type}::${relationship.target}`;
}
