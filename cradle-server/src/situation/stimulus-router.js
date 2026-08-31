export function resolveStimulusTargets(envelope, { fallbackTarget = "_global" } = {}) {
  const targets = [...new Set(
    (envelope?.targetCellIds ?? []).map(String).map((value) => value.trim()).filter(Boolean)
  )];
  return targets.length > 0 ? targets : [fallbackTarget];
}
