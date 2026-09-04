import { toCellSummary } from "./cell-dto.js";

export class SetAllCellsActiveUseCase {
  constructor({ engine, eventStream = null, heartbeatScheduler = null }) {
    this.engine = engine;
    this.eventStream = eventStream;
    this.heartbeatScheduler = heartbeatScheduler;
  }

  async execute({ active }) {
    if (active) {
      await this.engine.activateAllCells();
      this.heartbeatScheduler?.start();
    } else {
      this.heartbeatScheduler?.stop();
      await this.engine.deactivateAllCells({ waitForTicks: true });
    }

    const cells = await Promise.all(
      this.engine.listCells().map((cell) => toCellSummary(cell))
    );

    const cultivation = this.engine.getCultivationStatus?.() ?? null;
    this.eventStream?.publish("cell.updated", {
      cellIds: cells.map((cell) => cell.cellId),
    });
    this.eventStream?.publish("cultivation.updated", { cultivation });

    return {
      cells,
      cultivation,
    };
  }
}
