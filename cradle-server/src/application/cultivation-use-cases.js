import { HeartbeatMode } from "../heartbeat/heartbeat-mode.js";
import { RunHeartbeatUseCase } from "./run-heartbeat-use-case.js";

export class GetCultivationStatusUseCase {
  constructor({ engine, heartbeatModeStoreFactory }) {
    this.engine = engine;
    this.heartbeatModeStoreFactory = heartbeatModeStoreFactory;
  }

  async execute() {
    return resolveCultivationStatus({
      engine: this.engine,
      heartbeatModeStoreFactory: this.heartbeatModeStoreFactory,
    });
  }
}

export class StartCultivationUseCase {
  constructor({
    engine,
    heartbeatModeStoreFactory,
    heartbeatServiceFactory,
    operationRunner,
  }) {
    this.engine = engine;
    this.heartbeatModeStoreFactory = heartbeatModeStoreFactory;
    this.heartbeatServiceFactory = heartbeatServiceFactory;
    this.operationRunner = operationRunner;
  }

  async execute() {
    await this.heartbeatModeStoreFactory().setMode(HeartbeatMode.AUTOMATIC);

    const status = await resolveCultivationStatus({
      engine: this.engine,
      heartbeatModeStoreFactory: this.heartbeatModeStoreFactory,
    });
    const operation = await new RunHeartbeatUseCase({
      engine: this.engine,
      heartbeatServiceFactory: this.heartbeatServiceFactory,
      operationRunner: this.operationRunner,
    }).execute();

    return {
      ...status,
      ...operation,
    };
  }
}

export class StopCultivationUseCase {
  constructor({ engine, heartbeatModeStoreFactory }) {
    this.engine = engine;
    this.heartbeatModeStoreFactory = heartbeatModeStoreFactory;
  }

  async execute() {
    await this.heartbeatModeStoreFactory().setMode(HeartbeatMode.MANUAL);

    return resolveCultivationStatus({
      engine: this.engine,
      heartbeatModeStoreFactory: this.heartbeatModeStoreFactory,
    });
  }
}

async function resolveCultivationStatus({ engine, heartbeatModeStoreFactory }) {
  const store = heartbeatModeStoreFactory();
  const state =
    typeof store.getState === "function"
      ? await store.getState()
      : { mode: await store.getMode(), startedAt: null };
  const activeCells = engine
    .listCells()
    .filter((cell) => cell.active === true).length;

  return {
    running: state.mode === HeartbeatMode.AUTOMATIC,
    activeCells,
    startedAt: state.startedAt ?? null,
  };
}
