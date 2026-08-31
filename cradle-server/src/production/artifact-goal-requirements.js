export function extractArtifactGoalRequirements(goal) {
  const normalizedGoal = String(goal ?? "").toLowerCase();
  const requirements = [];
  const nameMatch = normalizedGoal.match(/名稱為\s*(\w+)/);
  if (nameMatch) {
    requirements.push({ term: nameMatch[1], required: true, type: "name" });
  }

  const methodMatches = [
    ...normalizedGoal.matchAll(/包含\s*(\w+)\s*方法/g),
    ...normalizedGoal.matchAll(/(\w+)\s*\(\s*[^)]*\s*\)\s*方法/g),
  ];
  for (const match of methodMatches) {
    if (match[1]) {
      requirements.push({ term: match[1], required: true, type: "method" });
    }
  }

  const fieldMatch = normalizedGoal.match(/欄位包含\s*([\w,\s]+)/);
  if (fieldMatch) {
    for (const field of fieldMatch[1].split(/[,\s]+/).filter(Boolean)) {
      requirements.push({ term: field, required: true, type: "field" });
    }
  }

  const returnMatch = normalizedGoal.match(/回傳\s*([\w\s]+)/);
  if (returnMatch?.[1]?.trim()) {
    requirements.push({
      term: returnMatch[1].trim(),
      required: false,
      type: "return",
    });
  }
  return requirements;
}
