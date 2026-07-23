import fs from "fs/promises";

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
    try {
      const raw = await fs.readFile(this.lifecycleEventsFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async appendLifecycleEvent(event = {}) {
    const events = await this.readLifecycleEvents();

    events.push({
      at: this.now().toISOString(),
      ...event,
    });

    await fs.writeFile(
      this.lifecycleEventsFile,
      JSON.stringify(events, null, 2),
      "utf8"
    );
  }
}
