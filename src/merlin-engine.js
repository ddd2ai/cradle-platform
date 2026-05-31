// merlin-engine.js
import readline from "readline";
import fs from "fs/promises";
import { MerlinCell } from "./merlin-cell.js";
import {
  clearScreen,
  renderBoot,
  renderSummon,
  renderPrompt,
  renderAnswerStart,
  renderError,
  renderBye,
} from "./merlin-ui.js";

export class MerlinEngine {
  constructor({ model = "gpt-4.1" } = {}) {
    this.model = model;
    this.cells = new Map();
    this.MERLIN_ID = "Merlin";
    this.activeCellId = this.MERLIN_ID;
    this.rl = null;
  }

  async start() {
    clearScreen();
    renderBoot(this.model);
    await renderSummon();

    await this.loadCells();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.loop();
  }

  async loadCells() {
    await fs.mkdir("cells", { recursive: true });

    const entries = await fs.readdir("cells", { withFileTypes: true });
    const cellDirs = entries.filter((e) => e.isDirectory());

    if (cellDirs.length === 0) {
      await this.createCell("cell-001");
    } else {
      for (const dir of cellDirs) {
        await this.registerCell(dir.name);
      }
    }

    this.activeCellId = this.MERLIN_ID;
  }

  isMerlinMode() {
    return this.activeCellId === this.MERLIN_ID;
  }

  async createCell(id) {
    const cell = new MerlinCell({
      id,
      name: id,
      model: this.model,
    });

    await cell.prepare();
    this.cells.set(id, cell);

    return cell;
  }

  async registerCell(id) {
    const cell = new MerlinCell({
      id,
      name: id,
      model: this.model,
    });

    await cell.prepare();
    this.cells.set(id, cell);

    return cell;
  }

  getActiveCell() {
    const cell = this.cells.get(this.activeCellId);

    if (!cell) {
      throw new Error(`Active cell not found: ${this.activeCellId}`);
    }

    return cell;
  }

  loop() {
    this.rl.question(renderPrompt(this.activeCellId), async (input) => {
      const trimmed = input.trim();

      if (trimmed === "exit") {
        await this.shutdown();
        return;
      }

      try {
        await this.handleInput(trimmed);
      } catch (error) {
        renderError(error);
      }

      this.loop();
    });
  }

  async handleInput(input) {
    if (!input) return;

    if (input === "/merlin" || input === "/use Merlin") {
      this.activeCellId = this.MERLIN_ID;
      console.log("Returned to Merlin");
      return;
    }

    if (input === "/cells") {
      console.log([...this.cells.keys()].join("\n"));
      return;
    }

    if (input === "/status") {
      const rows = [];

      for (const [id, cell] of this.cells) {
        const profile = await cell.readCellProfile();

        rows.push({
          Cell: id,
          Status: profile?.status ?? "unknown",
          Maturity: profile?.maturity ?? 0,
        });
      }

      console.table(rows);
      return;
    }

    if (input.startsWith("/new ")) {
      const id = input.replace("/new ", "").trim();

      if (!id) {
        console.log("Usage: /new cell-002");
        return;
      }

      if (id === this.MERLIN_ID) {
        console.log("Merlin is reserved for Engine mode.");
        return;
      }

      if (this.cells.has(id)) {
        console.log(`Cell already exists: ${id}`);
        return;
      }

      await this.createCell(id);
      this.activeCellId = id;

      console.log(`Created and switched to ${id}`);
      return;
    }

    if (input.startsWith("/use ")) {
      const id = input.replace("/use ", "").trim();

      if (id === this.MERLIN_ID) {
        this.activeCellId = this.MERLIN_ID;
        console.log("Returned to Merlin");
        return;
      }

      if (!this.cells.has(id)) {
        console.log(`Cell not found: ${id}`);
        return;
      }

      this.activeCellId = id;
      console.log(`Switched to ${id}`);
      return;
    }

    if (input === "/whoami") {
      if (this.isMerlinMode()) {
        console.log(`
Mode      : Merlin
Role      : Engine Console
Model     : ${this.model}
Cells     : ${this.cells.size}
`);
        return;
      }

      const cell = this.getActiveCell();

      console.log(`
Cell ID   : ${cell.id}
Cell Name : ${cell.name}
Model     : ${cell.model}
`);
      return;
    }

    if (this.isMerlinMode()) {
      console.log("You are in Merlin mode. Use /use <cell-id> to enter a cell.");
      return;
    }

    if (input === "/memory") {
      const cell = this.getActiveCell();
      console.log(await cell.readMemoryContext());
      return;
    }

    if (input.startsWith("/feed ")) {
      const cell = this.getActiveCell();
      const content = input.replace("/feed ", "").trim();

      if (!content) {
        console.log("Usage: /feed <content>");
        return;
      }

      await cell.appendKnowledge(`## ${new Date().toISOString()}\n\n${content}`);
      console.log("Memory updated.");
      return;
    }

    if (input === "/workspace") {
      const cell = this.getActiveCell();
      const files = await cell.listWorkspace();

      console.log(files.length ? files.join("\n") : "(empty workspace)");
      return;
    }

    if (input === "/snapshot") {
      const cell = this.getActiveCell();
      const snapshot = await cell.createSnapshot();

      console.log(`Snapshot created: ${snapshot}`);
      return;
    }

    if (input === "/snapshots") {
      const cell = this.getActiveCell();
      const snapshots = await cell.listSnapshots();

      console.log(snapshots.length ? snapshots.join("\n") : "(no snapshots)");
      return;
    }

    if (input.startsWith("/restore ")) {
      const cell = this.getActiveCell();
      const snapshotName = input.replace("/restore ", "").trim();

      if (!snapshotName) {
        console.log("Usage: /restore <snapshot-name>");
        return;
      }

      await cell.restoreSnapshot(snapshotName);
      console.log(`Snapshot restored: ${snapshotName}`);
      return;
    }

    const cell = this.getActiveCell();

    renderAnswerStart();
    await cell.ask(input);
  }

  async shutdown() {
    renderBye();
    this.rl?.close();

    for (const cell of this.cells.values()) {
      await cell.shutdown();
    }
  }
}