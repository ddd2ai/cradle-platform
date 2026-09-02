export async function toCellSummary(cell) {
  const [profile, cultivation] = await Promise.all([
    cell.getProfile(),
    cell.getCultivationState?.() ?? null,
  ]);

  return {
    cellId: cell.id,
    name: cell.name ?? cell.id,
    status: profile.status ?? "unknown",
    active: cell.isActive(),
    maturity: profile.maturity ?? 0,
    generation: profile.generation ?? 1,
    parent: profile.parent ?? null,
    ...(cultivation ? { cultivation } : {}),
  };
}

export async function toCellDetail(cell) {
  const profile = await cell.getProfile();
  const lifecycle =
    typeof cell.getLifecycleView === "function"
      ? await cell.getLifecycleView()
      : null;

  return {
    ...(await toCellSummary(cell)),
    lifecycle,
    responsibilities: profile.responsibilities ?? [],
    relationships: profile.relationships ?? [],
    profile,
  };
}
