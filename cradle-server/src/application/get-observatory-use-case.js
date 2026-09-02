import { toCellSummary } from "./cell-dto.js";
import { calculateDNAMaturityFromHistory } from "../dna/dna-maturity.js";

const MAX_HISTORY_POINTS = 24;
const MAX_LIFECYCLE_EVENTS = 40;

export class GetObservatoryUseCase {
  constructor({ engine, now = () => new Date() }) {
    this.engine = engine;
    this.now = now;
  }

  async execute() {
    const cells = await Promise.all(
      this.engine.listCells().map((cell) => observeCell(cell)),
    );

    return {
      observedAt: this.now().toISOString(),
      cells,
    };
  }
}

async function observeCell(cell) {
  const [summary, maturity, history, events] = await Promise.all([
    toCellSummary(cell),
    cell.getMaturityInfo(),
    cell.readDNAHistory(),
    cell.readLifecycleEvents(),
  ]);
  const visibleHistory = history.slice(-MAX_HISTORY_POINTS);
  const historyOffset = history.length - visibleHistory.length;

  return {
    ...summary,
    maturity,
    dna: {
      history: visibleHistory,
      maturityTrend: visibleHistory.map((entry, index) => {
        const sample = calculateDNAMaturityFromHistory(
          history.slice(0, historyOffset + index + 1),
        );
        return {
          at: entry.at ?? null,
          reason: entry.reason ?? null,
          outcome: sample.sampleSize < 2 ? "insufficient_evidence" : "observed",
          percent: sample.sampleSize < 2 ? null : sample.percent,
          sampleSize: sample.sampleSize,
        };
      }),
    },
    lifecycleEvents: events.slice(-MAX_LIFECYCLE_EVENTS),
  };
}
