import { readJsonFile, writeJsonFile } from "../utils/json-file.js";

export class CellLifecycleEventStore {
  constructor({
    lifecycleEventsFile,
    now = () => new Date(),
  } = {}) {
    if (!lifecycleEventsFile) {
      throw new Error("CellLifecycleEventStore requires lifecycleEventsFile");
    }

    this.lifecycleEventsFile = lifecycleEventsFile;
    this.now = now;
  }

  async readLifecycleEvents() {
    return readJsonFile(this.lifecycleEventsFile, []);
  }

  async appendLifecycleEvent(event = {}) {
    const events = await this.readLifecycleEvents();

    events.push({
      at: this.now().toISOString(),
      ...event,
    });

    await writeJsonFile(this.lifecycleEventsFile, events);
  }
}
