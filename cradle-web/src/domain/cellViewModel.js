export function toCellViewModel(cell) {
  const id = cell.id ?? cell.cellId;
  const dna = cell.dna?.vector ?? cell.dna ?? cell.profile?.dna ?? {};
  const lifecycleStatus =
    cell.lifecycleDecision?.status ??
    cell.lifecycle?.status ??
    cell.lifecycle?.state ??
    cell.lifecycleState ??
    cell.profile?.lifecycle?.state ??
    cell.status ??
    "Unknown";
  const lifecycleDecision =
    cell.lifecycleDecision?.decision ??
    cell.lifecycle?.decision ??
    null;
  const maturityInfo =
    typeof cell.maturity === "object"
      ? normalizeMaturityInfo(cell.maturity)
      : typeof cell.metrics?.maturity === "object"
        ? normalizeMaturityInfo(cell.metrics.maturity)
        : typeof cell.maturity === "number"
          ? { value: cell.maturity }
          : typeof cell.metrics?.maturity === "number"
            ? { value: cell.metrics.maturity }
            : null;
  const workspaceSections = cell.workspace?.sections ?? {};

  return {
    id,
    name: cell.name ?? cell.profile?.name ?? id,
    status: cell.status ?? lifecycleStatus ?? "idle",
    lifecycle: lifecycleStatus,
    lifecycleInfo: normalizeLifecycleInfo(lifecycleStatus, lifecycleDecision),
    maturity: maturityInfo?.value ?? null,
    maturityInfo,
    dnaDimensions:
      cell.dnaDimensions ??
      (Object.keys(dna).length > 0 ? Object.keys(dna).length : null),
    dnaVector: dna,
    workspacePath:
      cell.workspace?.path ??
      cell.workspacePath ??
      cell.profile?.directories?.workspace ??
      null,
    workspaceSections,
  };
}

function normalizeMaturityInfo(maturity = {}) {
  return {
    ...maturity,
    value: maturity.value ?? maturity.maturity ?? maturity.percent ?? null,
  };
}

function normalizeLifecycleInfo(status, decision) {
  if (!decision) {
    return null;
  }

  return {
    status,
    decision,
  };
}
