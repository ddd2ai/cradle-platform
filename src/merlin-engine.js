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
      id: crypto.randomUUID(),
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

  async tickAll() {
    console.log("");
    console.log("🫀 Colony Work Cycle");
    console.log("");

    for (const [id, cell] of this.cells) {
      console.log(`[${id}] tick...`);

      try {
        const inbox = await cell.readInbox();
        this.inboxes.set(id, inbox);

        if (inbox.length === 0) {
          console.log("  idle: no inbox");
          console.log("");
          continue;
        }

        await cell.updateStatus("running");

        const result = await cell.processInbox(inbox);

        this.inboxes.set(id, []);
        await cell.clearInbox();

        await cell.updateStatus("idle");

        console.log(`  processed=${result.processed}`);
        console.log(`  maturity=${await cell.getMaturity()}`);
      } catch (error) {
        await cell.updateStatus("error");
        console.log(`  ✗ ${error.message}`);

        await cell.updateStatus("idle");
      }

      console.log("");
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
      /work                    Show colony work queue
      /tick                    Run one colony work cycle
      /heartbeat               Run one colony work cycle (legacy)

      /new <cell-id>           Create and switch to a new cell
      /use <cell-id>           Switch to a cell
      /merlin                  Return to Merlin engine mode
      /whoami                  Show current mode or cell

      /colony                  Show colony overview
      /colony-graph            Show colony relationship graph

      /ask <cell> <message>    Ask a specific cell
      /broadcast <message>     Send message to all cells
      /run-all <task>          Ask all cells to execute same task

      exit                     Shutdown engine

      
    Cell DNA:
      /dna                     Show current cell DNA context
      /dna init                Initialize DNA traits with AI


    Cell Communication:
      /send <cell> <message>   Send message to another cell
      /inbox                   Show inbox messages
      /process                 Process inbox into memory
      /clean-inbox             Clear inbox


    Cell Tasks:
      /tasks                   Show task queue
      /do                      Execute next pending task
      /digest                  Digest inbox into workspace


    Cell Memory:
      /memory                  Show active memory context
      /memory full             Show full memory files
      /thoughts                Show recent thoughts
      /feed <content>          Append knowledge
      /think                   Let current cell reflect and grow


    Cell Notes:
      /write-note <content>    Create note in workspace/notes
      /research <content>      Create research note
      /decide <content>        Create design decision


    Cell Workspace:
      /workspace               List workspace files
      /write <task>            Create workspace artifact
      /read <file>             Read workspace file
      /revise <file> <task>    Revise workspace file
      /share <file> <cell>     Share file to another cell
      /import <cell> <file>    Import file from another cell


    Cell Projects:
      /project-init <name>     Create project workspace
      /project-file <project> <file>
                              Create file inside project


    Cell Evolution:
      /profile                 Show cell profile
      /evolve                  Increase maturity
      /divide                  Create child cell
      /specialize <name>       Specialize cell

      /resp add <name>         Add responsibility
      /resp list               List responsibilities

      /link <type> <cell>      Create relationship
      /graph                   Show cell graph

    Cell Collaboration:
      /delegate <cell> <task>  Delegate task to another cell
      /report <cell> <file>    Report artifact to another cell
      /trace                   Show current cell collaboration trace

    Cell Snapshots:
      /snapshot                Create snapshot
      /snapshots               List snapshots
      /restore <name>          Restore snapshot
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