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

import { CommandRegistry } from "./commands/command-registry.js";
import { createEngineCommands } from "./commands/engine-commands.js";
import { createCellCommands } from "./commands/cell-commands.js";
import { createColonyCommands } from "./commands/colony-commands.js";

export class MerlinEngine {
  constructor({ model = "gpt-4.1" } = {}) {
    this.model = model;
    this.cells = new Map();
    this.inboxes = new Map();

    this.MERLIN_ID = "Merlin";
    this.activeCellId = this.MERLIN_ID;
    this.rl = null;

    this.commandRegistry = new CommandRegistry();
    this.registerCommands();
  }

  registerCommands() {
    this.commandRegistry.registerAll([
      ...createEngineCommands(),
      ...createColonyCommands(),
      ...createCellCommands(),
    ]);
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
    this.inboxes.set(id, await cell.readInbox());

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
    this.inboxes.set(id, await cell.readInbox());

    return cell;
  }

  ensureInbox(cellId) {
    if (!this.inboxes.has(cellId)) {
      this.inboxes.set(cellId, []);
    }
  }

  async pushMessage({ from, to, content, type = "message" }) {
    this.ensureInbox(to);

    const message = {
      from,
      to,
      type,
      content,
      createdAt: new Date().toISOString(),
    };

    this.inboxes.get(to).push(message);

    const cell = this.cells.get(to);

    if (cell) {
      await cell.appendInboxMessage(message);
    }
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

    const context = {
      engine: this,
      input,
    };

    const command = this.commandRegistry.find(input, context);

    if (command) {
      await command.execute(context);
      return;
    }

    if (this.isMerlinMode()) {
      console.log("You are in Merlin mode. Use /use <cell-id> to enter a cell.");
      return;
    }

    renderAnswerStart();
    await this.getActiveCell().ask(input);
  }

  formatTimestamp(date) {
    const pad = (n) => String(n).padStart(2, "0");

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      "-",
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join("");
  }

  cleanMarkdownFence(content = "") {
    return content
      .replace(/^```markdown\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }

  printHelp() {
    console.log(`
Merlin Engine Commands

Engine:
  /help                    Show commands
  /cells                   List cells
  /status                  Show cell status
  /heartbeat               Run one evolution cycle for all cells
  /new <cell-id>           Create and switch to a new cell
  /use <cell-id>           Switch to a cell
  /merlin                  Return to Merlin engine mode
  /colony                  Show colony overview
  /colony-graph            Show colony relationship graph
  /whoami                  Show current mode or cell
  /ask <cell> <message>    Ask a specific cell without switching
  /broadcast <message>     Send message to all cells
  /run-all <task>          Ask all cells to execute same task
  exit                     Shutdown engine

Cell:
  /memory                  Show active memory context
  /memory full             Show full memory files
  /thoughts                Show recent thoughts
  /think                   Let current cell reflect and grow
  /feed <content>          Append knowledge to current cell
  /send <cell> <message>   Send message to another cell
  /process                 Process inbox into memory and thoughts
  /clean-inbox             Clear current cell inbox
  /inbox                   Show messages received by current cell
  /write <task>            Ask current cell to create a workspace markdown file
  /read <file>             Read a workspace file
  /revise <file> <task>    Revise a workspace file
  /share <file> <cell>     Share file to another cell
  /import <cell> <file>    Import file from another cell
  /workspace               List workspace files
  /snapshot                Create snapshot
  /snapshots               List snapshots
  /restore <name>          Restore snapshot
  /evolve                  Increase maturity
  /divide                  Create child cell
  /resp add <name>         Add responsibility
  /resp list               List responsibilities
  /link <type> <cell>      Create relationship
  /graph                   Show cell graph
  /profile                 Show cell profile
  /digest                  Digest inbox into workspace
  /specialize <name>       Specialize cell
`);
  }

  async shutdown() {
    renderBye();
    this.rl?.close();

    for (const cell of this.cells.values()) {
      await cell.shutdown();
    }
  }
}