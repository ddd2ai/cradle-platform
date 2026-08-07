// cradle-engine.js
import readline from "readline";
import fs from "fs/promises";
import path from "path";
import { CradleCell } from "./cradle-cell.js";
import {
  clearScreen,
  renderBoot,
  renderSummon,
  renderPrompt,
  renderAnswerStart,
  renderError,
  renderBye,
} from "./cradle-console.js";

import { CommandRegistry } from "./commands/command-registry.js";
import { createEngineCommands } from "./commands/engine-commands.js";
import { createCellCommands } from "./commands/cell-commands.js";
import { createColonyCommands } from "./commands/colony-commands.js";
import { createProductionCommands } from "./commands/production-commands.js";
import { createExecutionCommands } from "./commands/execution-commands.js";
import { createLifecycleCommands } from "./commands/lifecycle-commands.js";
import dnaPlot2DCommand from "./commands/plot2d-command.js";
import { PROJECT_ROOT } from "./project-root.js";

export class CradleEngine {
  constructor({ 
      model = "gpt-5-mini",
      provider = "copilot",
      timeoutSeconds = 3600,
      heartbeatMode = "manual",
      projectRoot = PROJECT_ROOT,
  } = {}) {
    this.model = model;
    this.provider = provider;
    this.timeoutSeconds = timeoutSeconds;
    this.heartbeatMode = heartbeatMode;
    this.projectRoot = projectRoot;

    this.cells = new Map();
    this.inboxes = new Map();
    this.stagedCellIds = new Set();
    this.cellSyncPromise = null;

    this.CRADLE_ID = "Cradle";
    this.activeCellId = this.CRADLE_ID;
    this.rl = null;
    this.watchTimer = null;
    this.cultivation = {
      status: "dormant",
      startedAt: null,
      stoppingAt: null,
    };

    this.commandRegistry = new CommandRegistry();
    this.registerCommands();
  }

  registerCommands() {
    this.commandRegistry.registerAll([
      ...createEngineCommands(),
      ...createColonyCommands(),
      ...createCellCommands(),
      ...createLifecycleCommands(),
      ...createProductionCommands(),
      ...createExecutionCommands(),
      dnaPlot2DCommand,
    ]);
  }

  setAiSettings({ provider, model } = {}) {
    if (provider) {
      this.provider = provider;
    }

    if (model) {
      this.model = model;
    }

    for (const cell of this.cells.values()) {
      if (provider) {
        cell.provider = provider;
      }

      if (model) {
        cell.model = model;
      }
    }
  }

  async start() {
    clearScreen();

    renderBoot({
      provider: this.provider,
      model: this.model,
      timeoutSeconds: this.timeoutSeconds,
      heartbeatMode: this.heartbeatMode,
    });
    
    await renderSummon();

    await this.loadCells();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.loop();
  }

  async loadCells() {
    const cellsDir = path.join(this.projectRoot, "cells");
    await fs.mkdir(cellsDir, { recursive: true });

    const entries = await fs.readdir(cellsDir, { withFileTypes: true });
    const cellDirs = entries.filter((e) => e.isDirectory());

    if (cellDirs.length === 0) {
      await this.createCell("cell-001");
    } else {
      await this.syncCellsFromDisk();
    }

    this.activeCellId = this.CRADLE_ID;
  }

  isCradleMode() {
    return this.activeCellId === this.CRADLE_ID;
  }

  async createCell(id, { staged = false } = {}) {
    const cell = new CradleCell({
      id,
      name: id,
      model: this.model,
      provider: this.provider,
      projectRoot: this.projectRoot,
    });

    if (staged) {
      await fs.mkdir(cell.rootDir, { recursive: true });
      await fs.writeFile(this._cellInitializingFile(cell.rootDir), "");
      this.stagedCellIds.add(id);
    }

    await cell.prepare();
    this.cells.set(id, cell);
    this.inboxes.set(id, await cell.readInbox());

    return cell;
  }

  async markCellReady(cellId) {
    const cell = this.cells.get(cellId);
    if (!cell) {
      throw new Error(`Cell not found: ${cellId}`);
    }

    await fs.rm(this._cellInitializingFile(cell.rootDir), { force: true });
    this.stagedCellIds.delete(cellId);
  }

  async syncCellsFromDisk() {
    if (this.cellSyncPromise) {
      return this.cellSyncPromise;
    }

    this.cellSyncPromise = this._syncCellsFromDisk();

    try {
      return await this.cellSyncPromise;
    } finally {
      this.cellSyncPromise = null;
    }
  }

  async _syncCellsFromDisk() {
    const cellsDir = path.join(this.projectRoot, "cells");
    await fs.mkdir(cellsDir, { recursive: true });
    const entries = await fs.readdir(cellsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || this.cells.has(entry.name)) {
        continue;
      }

      const rootDir = path.join(cellsDir, entry.name);
      if (await this._isCellInitializing(rootDir)) {
        continue;
      }

      await this.registerCell(entry.name);
    }
  }

  async _isCellInitializing(rootDir) {
    try {
      await fs.access(this._cellInitializingFile(rootDir));
      return true;
    } catch {
      return false;
    }
  }

  _cellInitializingFile(rootDir) {
    return path.join(rootDir, ".cell-initializing");
  }

  async registerCell(id) {
    const cell = new CradleCell({
      id,
      name: id,
      model: this.model,
      provider: this.provider,
      projectRoot: this.projectRoot,
    });

    await cell.prepare();
    this.cells.set(id, cell);
    this.inboxes.set(id, await cell.readInbox());

    return cell;
  }

  hasCell(cellId) {
    return this.cells.has(cellId);
  }

  getCell(cellId) {
    if (!cellId) {
      throw new Error("cellId is required");
    }

    if (this.stagedCellIds.has(cellId)) {
      return null;
    }

    return this.cells.get(cellId) ?? null;
  }

  requireCell(cellId) {
    const cell = this.getCell(cellId);

    if (!cell) {
      throw new Error(
        `Cell not found: ${cellId}. Available cells: ${[
          ...this.cells.keys(),
        ].join(", ")}`
      );
    }

    return cell;
  }

  listCells() {
    return [...this.cells.values()].filter(
      (cell) => !this.stagedCellIds.has(cell.id)
    );
  }

  listCellIds() {
    return this.listCells().map((cell) => cell.id);
  }

  useCell(cellId) {
    if (!cellId) {
      throw new Error("cellId is required");
    }

    const cell = this.cells.get(cellId);

    if (!cell) {
      throw new Error(
        `Cell ${cellId} not found. Available cells: ${[
          ...this.cells.keys(),
        ].join(", ")}`
      );
    }

    this.activeCellId = cellId;

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

    return message;
  }

  async activateCell(cellId) {
    const cell = this.cells.get(cellId);

    if (!cell) {
      console.log(`Cell not found: ${cellId}`);
      return;
    }

    await cell.activate();
  }

  async deactivateCell(cellId) {
    const cell = this.cells.get(cellId);

    if (!cell) {
      console.log(`Cell not found: ${cellId}`);
      return;
    }

    await cell.deactivate();
  }

  async activateAllCells() {
    this.cultivation = {
      status: "starting",
      startedAt: this.cultivation.startedAt ?? new Date().toISOString(),
      stoppingAt: null,
    };

    for (const cell of this.cells.values()) {
      await cell.activate();
    }

    this.cultivation.status = "running";
  }

  async deactivateAllCells({ waitForTicks = false } = {}) {
    this.cultivation = {
      ...this.cultivation,
      status: "stopping",
      stoppingAt: this.cultivation.stoppingAt ?? new Date().toISOString(),
    };

    for (const cell of this.cells.values()) {
      await cell.deactivate();
    }

    if (waitForTicks) {
      await this.waitForActiveTicks();
    }

    this.cultivation = {
      status: "dormant",
      startedAt: null,
      stoppingAt: null,
    };
  }

  getActiveTicks() {
    return [...this.cells.values()]
      .map((cell) => cell.getActiveTick?.())
      .filter(Boolean);
  }

  async waitForActiveTicks() {
    const activeTicks = this.getActiveTicks();

    await Promise.allSettled(
      activeTicks.map((tick) => tick.promise)
    );
  }

  getCultivationStatus() {
    const activeTicks = this.getActiveTicks();
    const activeCells = [...this.cells.values()].filter((cell) =>
      cell.isActive()
    ).length;

    return {
      status: this.cultivation.status,
      activeCells,
      activeTicks: activeTicks.length,
      runningTasks: activeTicks.length,
      activeTickCellIds: activeTicks.map((tick) => tick.cellId),
      startedAt: this.cultivation.startedAt,
      stoppingAt: this.cultivation.stoppingAt,
    };
  }

  async tickAll() {
    console.log("");
    console.log("🫀 Manual Colony Tick");
    console.log("");

    for (const [id, cell] of this.cells) {
      console.log(`[${id}] tick...`);

      try {
        const result = await cell.tick();

        const inbox = await cell.readInbox();
        this.inboxes.set(id, inbox);

        console.log(`  processed=${result.processed ?? 0}`);

        if (result.reason) {
          console.log(`  reason=${result.reason}`);
        }

        console.log(`  maturity=${await cell.getMaturity()}`);
      } catch (error) {
        console.log(`  ✗ ${error.message}`);
      }

      console.log("");
    }
  }

  getActiveCell() {
    if (this.isCradleMode()) {
      throw new Error("No active cell. Use /use <cell-id> to enter a cell.");
    }

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

    await this.syncCellsFromDisk();

    const context = {
      engine: this,
      input,
    };

    const command = this.commandRegistry.find(input, context);

    if (command) {
      await command.execute(context);
      return;
    }

    if (this.isCradleMode()) {
      console.log("You are in Cradle mode. Use /use <cell-id> to enter a cell.");
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
    Cradle Engine Commands

    Engine:
      /help                    Show commands
      /whoami                  Show current mode or cell

      /cells                   List cells
      /cells-status            Show all cell statuses

      /activate <cell-id>      Activate a cell
      /deactivate <cell-id>    Deactivate a cell
      /activate-all            Activate all cells
      /deactivate-all          Deactivate all cells

      /work                    Show colony work queue
      /evolution-status        Show colony evolution status
      /colony-dna              Show colony DNA matrix
      /tick                    Manually tick all cells once
      /heartbeat               Run one colony work cycle (legacy)

      /new <cell-id>           Create and switch to a new cell
      /use <cell-id>           Switch to a cell
      /cradle                  Return to Cradle engine mode

      /colony                  Show colony overview
      /colony-graph            Show colony relationship graph

      /watch                   Start live colony dashboard
      /unwatch                 Stop live colony dashboard

      /ask <cell> <message>    Ask a specific cell
      /broadcast <message>     Send message to all cells
      /run-all <task>          Ask all cells to execute same task

      exit                     Shutdown engine

    Situation:
      /observe                List all situation stimuli
      /perceive               Analyze stimuli and create observation
      

    Environment:
      /env plan                Show environment install plan
      /env prepare             Prepare environment

    Config:
      DNA_DEFINITION.md        Define DNA traits
      DNA_FACTORS.md           Define maturity factors
      VISION.md                Define evolution direction
      ENVIRONMENT.md           Define runtime environment

    Analysis:
      /plot2d <x> <y>      Project DNA vectors into 2D space

                               Examples:
                               /plot2d CRE COL
                               /plot2d EVO REF
                               /plot2d PER DEC

                               Available DNA Factors:
                               PER (Perception)
                               DEC (Decision)
                               DEP (Decomposition)
                               LEA (Learning)
                               COL (Collaboration)
                               CRE (Creation)
                               EVO (Evolution)
                               REF (Reflection)

    Cell Growth:
      /status                  Show current cell status
      /think                   Generate one thought
      /thoughts                Show recent thoughts

    Cell Evolution:
      /evolve                  Evolve from accumulated thoughts
      /evolution               Show latest evolution
      /evolutions              List evolution records

    Cell DNA:
      /dna                     Show DNA vector
      /dna-history             Show DNA history
      /dna init                Initialize DNA traits


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

      /project-file
          <project> <file>     Create file inside project


    Cell Production:
      /produce <type> <goal>   Produce an artifact draft
      /artifacts               List produced artifacts

      Artifact Types:
        code                   Source code
        document               Markdown document
        diagram                Mermaid / PlantUML diagram
        sql                    SQL script
        config                 JSON / YAML config
        test                   Test case
        spec                   Specification
        generic                General artifact


    Cell Evolution:
      /profile                 Show cell profile

      /evolve                  Increase maturity
      /divide                  Create child cell
      /divide-svd <cell-id>    Divide current cell by SVD DNA specialization
      /specialize <name>       Specialize cell

      /resp add <name>         Add responsibility
      /resp list               List responsibilities

      /link <type> <cell>      Create relationship
      /graph                   Show cell graph

    
      Cell Fusion:
      /fuse <parent...> <child>
                               Fuse multiple cells into a new child.

      /merge <parent...> <child>
                               Deprecated alias for /fuse.

                               Features:
                               • DNA centroid fusion
                               • Maturity-weighted inheritance
                               • Responsibility inheritance
                               • Parent memory archive
                               • Relationship creation
                               • Generation increment

                               Example:
                               /fuse cell-001 cell-002 cell-A

                               
    Cell Collaboration:
      /delegate <cell> <task>  Delegate task to another cell
      /report <cell> <file>    Report artifact to another cell
      /trace                   Show collaboration trace


    Cell Snapshots:
      /snapshot                Create snapshot
      /snapshots               List snapshots
      /restore <name>          Restore snapshot


    Cradle Philosophy:

      DNA
        What a cell can become

      Vision
        What a cell wants to become

      Environment
        Where a cell grows

      Evolution
        How a cell matures
    `);
  }

  async shutdown() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }

    renderBye();
    this.rl?.close();

    for (const cell of this.cells.values()) {
      await cell.shutdown();
    }
  }
}
