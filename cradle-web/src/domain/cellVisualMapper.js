import { mapDnaDimensions } from "../components/cell/dna-dimensions";
import { CELL_PALETTES } from "../constants/incubatorVisuals";
import { toCellViewModel } from "./cellViewModel";

export function mapCellToVisualState(cell, index = 0) {
  const view = toCellViewModel(cell);
  const activity = mapCellActivity(cell, view);
  const tone = getCellTone(view.id, index);

  return {
    ...view,
    active: cell.active === true,
    activity,
    activityLabel: formatActivity(activity),
    tone,
    palette: CELL_PALETTES[tone],
    textureSrc: `/cells/cell-${tone}.webp`,
    maturityPercentage: normalizePercentage(view.maturity),
    lifecycleStage: view.lifecycleInfo?.phase ?? null,
    dimensions: mapDnaDimensions(view.dnaVector),
  };
}

export function mapCellActivity(cell, view = toCellViewModel(cell)) {
  const cultivationState = String(
    cell.cultivation?.state ?? view.cultivation?.state ?? "",
  ).toLowerCase();
  const status = String(cell.status ?? view.status ?? "").toLowerCase();
  const phase = String(view.lifecycleInfo?.phase ?? "").toLowerCase();

  if (["stimulated", "growing"].includes(cultivationState)) return "growing";
  if (cultivationState === "stable") return "stable";
  if (cultivationState === "needs_attention") return "needs-attention";

  if (
    cell.active === false ||
    ["idle", "inactive", "dormant", "stopped"].includes(status)
  ) {
    return "idle";
  }

  if (
    ["repairing", "evolving", "dividing", "fusing"].includes(status) ||
    ["mature", "saturated"].includes(phase)
  ) {
    return "evolving";
  }

  if (["processing", "exploring", "thinking"].includes(status)) {
    return "exploring";
  }

  if (["seed", "growing"].includes(phase)) {
    return "growing";
  }

  return "healthy";
}

export function normalizePercentage(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const percentage = value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, percentage));
}

function getCellTone(cellId, index) {
  const normalizedId = String(cellId ?? "");

  if (/^b0?1$/i.test(normalizedId)) {
    return "green";
  }

  const numberedCell = normalizedId.match(/^cell-(\d+)$/i);

  if (numberedCell) {
    const paletteNames = ["purple", "cyan", "blue", "amber"];
    const paletteIndex = (Number(numberedCell[1]) - 1) % paletteNames.length;
    return paletteNames[Math.max(0, paletteIndex)];
  }

  const paletteNames = ["green", "purple", "cyan", "blue", "amber"];
  const hash = String(cellId ?? index)
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), index);

  return paletteNames[hash % paletteNames.length];
}

function formatActivity(activity) {
  if (activity === "needs-attention") return "Needs Attention";
  return `${activity.charAt(0).toUpperCase()}${activity.slice(1)}`;
}
