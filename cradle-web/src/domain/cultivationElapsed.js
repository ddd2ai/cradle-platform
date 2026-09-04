export function formatElapsed(startedAt, endAt = null) {
  const start = Date.parse(startedAt ?? "");
  const end = endAt ? Date.parse(endAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "0s";
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
