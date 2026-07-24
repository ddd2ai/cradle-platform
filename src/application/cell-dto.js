export async function toCellSummary(cell) {
  const profile = await cell.getProfile();

  return {
    cellId: cell.id,
    name: cell.name ?? cell.id,
    status: profile.status ?? "unknown",
    active: cell.isActive(),
    maturity: profile.maturity ?? 0,
    generation: profile.generation ?? 1,
    parent: profile.parent ?? null,
  };
}

export async function toCellDetail(cell) {
  const profile = await cell.getProfile();

  return {
    ...(await toCellSummary(cell)),
    responsibilities: profile.responsibilities ?? [],
    relationships: profile.relationships ?? [],
    profile,
  };
}
