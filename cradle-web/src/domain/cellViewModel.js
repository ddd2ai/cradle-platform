export function toCellViewModel(cell) {
  const id = cell.id ?? cell.cellId;
  const dna = cell.dna?.vector ?? cell.dna ?? cell.profile?.dna ?? {};
  const maturity =
    typeof cell.maturity === "object"
      ? cell.maturity?.percent ?? cell.maturity?.maturity
      : cell.maturity ?? cell.metrics?.maturity ?? null;
  const workspaceSections = cell.workspace?.sections ?? {};

  return {
    id,
    name: cell.name ?? cell.profile?.name ?? id,
    status: cell.status ?? cell.lifecycle?.status ?? "idle",
    lifecycle:
      cell.lifecycle?.state ??
      cell.lifecycleState ??
      cell.profile?.lifecycle?.state ??
      cell.status ??
      "Unknown",
    maturity,
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
