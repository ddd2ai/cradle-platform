export function resolveRepairTypeFromDetail(detail = {}) {
  if (Number(detail.recentFailureRate ?? 0) > 0.30) {
    return "artifact";
  }

  if (Number(detail.temporalVariance ?? 0) > 0.20) {
    return "dna";
  }

  return "unknown";
}

export function resolveRepairTypeFromPlan(plan) {
  return resolveRepairTypeFromDetail(
    plan?.decision?.detail ?? {}
  );
}

export function resolveRepairTypeFromDecision(decision) {
  return resolveRepairTypeFromDetail(
    decision?.detail ?? {}
  );
}
