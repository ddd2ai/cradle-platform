import { HeartbeatMode } from "./heartbeat-mode.js";
import { RunHeartbeatUseCase } from "../application/run-heartbeat-use-case.js";

export class HeartbeatScheduler {
  constructor({ engine, operationRunner, heartbeatServiceFactory, heartbeatModeStoreFactory, intervalMs = 30_000 } = {}) {
    this.engine = engine;
    this.operationRunner = operationRunner;
    this.heartbeatServiceFactory = heartbeatServiceFactory;
    this.heartbeatModeStoreFactory = heartbeatModeStoreFactory;
    this.intervalMs = Math.max(5_000, Number(intervalMs) || 30_000);
    this.timer = null;
    this.running = false;
  }
  start() {
    if (this.timer) return false;
    this.timer = setInterval(() => this.runIfAutomatic().catch(() => {}), this.intervalMs);
    this.timer.unref?.();
    this.runIfAutomatic().catch(() => {});
    return true;
  }
  stop() {
    if (!this.timer) return false;
    clearInterval(this.timer); this.timer = null; return true;
  }
  async runIfAutomatic() {
    if (this.running || !this.engine?.getCultivationStatus?.().activeCells) return null;
    if (await this.heartbeatModeStoreFactory().getMode() !== HeartbeatMode.AUTOMATIC) return null;
    this.running = true;
    try {
      return await new RunHeartbeatUseCase({ engine: this.engine, operationRunner: this.operationRunner, heartbeatServiceFactory: this.heartbeatServiceFactory }).execute();
    } finally { this.running = false; }
  }
}
