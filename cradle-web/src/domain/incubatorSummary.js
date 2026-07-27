export const CELL_SUMMARY_STATUS = {
  active: "active",
  idle: "idle",
};

export const NON_SUMMARY_CELL_STATUSES = [
  "running",
  "error",
  "stopped",
  "unknown",
];

export function getIncubatorSummary(cells = [], { unavailable = false } = {}) {
  if (unavailable) {
    return {
      totalCells: null,
      activeCells: null,
      idleCells: null,
      averageMaturity: null,
      averageMaturityLabel: "--",
    };
  }

  const validMaturities = [];
  let activeCells = 0;
  let idleCells = 0;

  for (const cell of cells) {
    const status = normalizeStatus(cell?.status);

    if (status === CELL_SUMMARY_STATUS.active) {
      activeCells += 1;
    } else if (status === CELL_SUMMARY_STATUS.idle) {
      idleCells += 1;
    }

    const maturity = readMaturityValue(cell);

    if (Number.isFinite(maturity)) {
      validMaturities.push(maturity);
    }
  }

  const averageMaturity =
    validMaturities.length > 0
      ? validMaturities.reduce((sum, value) => sum + value, 0) / validMaturities.length
      : null;

  return {
    totalCells: cells.length,
    activeCells,
    idleCells,
    averageMaturity,
    averageMaturityLabel: formatMaturityPercent(averageMaturity),
  };
}

export function formatMaturityPercent(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const percent = value <= 1 ? value * 100 : value;

  return `${Math.round(percent)}%`;
}

function normalizeStatus(status) {
  return String(status ?? "").trim().toLowerCase();
}

function readMaturityValue(cell) {
  const maturity = cell?.maturity;

  if (typeof maturity === "number") {
    return maturity;
  }

  if (maturity && typeof maturity === "object") {
    const value = maturity.value ?? maturity.maturity ?? maturity.percent;

    return Number(value);
  }

  return Number.NaN;
}
