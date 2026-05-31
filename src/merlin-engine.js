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

    if (input === "/help") {
      this.printHelp();
      return;
    }

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

    const cell = this.getActiveCell();

    if (input === "/memory") {
      console.log(await cell.buildMemoryContext());
      return;
    }

    if (input === "/memory full") {
      console.log(`
# Identity

${await cell.safeReadMemory("identity")}

---

# Rules

${await cell.safeReadMemory("rules")}

---

# Knowledge

${await cell.safeReadMemory("knowledge")}

---

# History

${await cell.safeReadMemory("history")}
`);
      return;
    }

    if (input === "/thoughts") {
      console.log(await cell.readRecentThoughts(12000));
      return;
    }

    if (input.startsWith("/feed ")) {
      const content = input.replace("/feed ", "").trim();

      if (!content) {
        console.log("Usage: /feed <content>");
        return;
      }

      await cell.appendKnowledge(`## ${new Date().toISOString()}\n\n${content}`);
      console.log("Memory updated.");
      return;
    }

    if (input.startsWith("/write ")) {
      const content = input.replace("/write ", "").trim();

      if (!content) {
        console.log("Usage: /write <task>");
        return;
      }

      const filename = `note-${this.formatTimestamp(new Date())}.md`;

      renderAnswerStart();

      const result = await cell.ask(`
    請根據以下任務產生一份 Markdown 文件內容。

    任務：
    ${content}

    請只輸出 Markdown 內容，不要額外解釋。
    `);

      const outputText = this.cleanMarkdownFence(result?.text ?? result?.answer ?? "");

      await cell.writeWorkspaceFile(filename, outputText);

      console.log(`\nWorkspace file created: ${filename}`);
      return;
    }

    if (input.startsWith("/read ")) {
      const fileName = input.replace("/read ", "").trim();

      if (!fileName) {
        console.log("Usage: /read <workspace-file>");
        return;
      }

      try {
        const content = await cell.readWorkspaceFile(fileName);
        console.log(content);
      } catch (error) {
        console.log(`Workspace file not found: ${fileName}`);
      }

      return;
    }

  
    if (input.startsWith("/revise ")) {
      const args = input.replace("/revise ", "").trim();
      const firstSpaceIndex = args.indexOf(" ");

      if (firstSpaceIndex === -1) {
        console.log("Usage: /revise <workspace-file> <task>");
        return;
      }

      const fileName = args.slice(0, firstSpaceIndex).trim();
      const task = args.slice(firstSpaceIndex + 1).trim();

      if (!fileName || !task) {
        console.log("Usage: /revise <workspace-file> <task>");
        return;
      }

      let originalContent = "";

      try {
        originalContent = await cell.readWorkspaceFile(fileName);
      } catch {
        console.log(`Workspace file not found: ${fileName}`);
        return;
      }

      renderAnswerStart();

      const result = await cell.ask(`
    請根據修改任務，重寫以下 Markdown 文件。

    請遵守：
    - 只輸出修改後的 Markdown 文件內容
    - 不要輸出說明
    - 不要包在 \`\`\`markdown code fence 裡
    - 不要新增目前系統尚未實作的能力

    # 修改任務

    ${task}

    ---

    # 原始文件

    ${originalContent}
    `);

      const outputText = this.cleanMarkdownFence(result?.text ?? result?.answer ?? "");

      await cell.writeWorkspaceFile(fileName, outputText);

      console.log(`\nWorkspace file revised: ${fileName}`);
      return;
    }


    if (input.startsWith("/share ")) {
      const args = input.replace("/share ", "").trim().split(/\s+/);

      if (args.length < 2) {
        console.log("Usage: /share <workspace-file> <target-cell-id>");
        return;
      }

      const [fileName, targetCellId] = args;

      const targetCell = this.cells.get(targetCellId);

      if (!targetCell) {
        console.log(`Target cell not found: ${targetCellId}`);
        return;
      }

      try {
        const content = await cell.readWorkspaceFile(fileName);

        await targetCell.writeWorkspaceFile(
          fileName,
          content
        );

        console.log(
          `Shared ${fileName} from ${cell.id} to ${targetCellId}`
        );
      } catch {
        console.log(`Workspace file not found: ${fileName}`);
      }

      return;
    }

    if (input.startsWith("/import ")) {
      const args = input.replace("/import ", "").trim().split(/\s+/);

      if (args.length < 2) {
        console.log("Usage: /import <source-cell-id> <workspace-file>");
        return;
      }

      const [sourceCellId, fileName] = args;

      const sourceCell = this.cells.get(sourceCellId);

      if (!sourceCell) {
        console.log(`Source cell not found: ${sourceCellId}`);
        return;
      }

      try {
        const content =
          await sourceCell.readWorkspaceFile(fileName);

        await cell.writeWorkspaceFile(
          fileName,
          content
        );

        console.log(
          `Imported ${fileName} from ${sourceCellId} to ${cell.id}`
        );
      } catch {
        console.log(
          `Workspace file not found in ${sourceCellId}: ${fileName}`
        );
      }

      return;
    }


    if (input === "/workspace") {
      const files = await cell.listWorkspace();

      console.log(files.length ? files.join("\n") : "(empty workspace)");
      return;
    }

    if (input === "/snapshot") {
      const snapshot = await cell.createSnapshot();

      console.log(`Snapshot created: ${snapshot}`);
      return;
    }

    if (input === "/snapshots") {
      const snapshots = await cell.listSnapshots();

      console.log(snapshots.length ? snapshots.join("\n") : "(no snapshots)");
      return;
    }

    if (input.startsWith("/restore ")) {
      const snapshotName = input.replace("/restore ", "").trim();

      if (!snapshotName) {
        console.log("Usage: /restore <snapshot-name>");
        return;
      }

      await cell.restoreSnapshot(snapshotName);
      console.log(`Snapshot restored: ${snapshotName}`);
      return;
    }

    renderAnswerStart();
    await cell.ask(input);
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
  /help                 Show commands
  /cells                List cells
  /status               Show cell status
  /new <cell-id>        Create and switch to a new cell
  /use <cell-id>        Switch to a cell
  /merlin               Return to Merlin engine mode
  /whoami               Show current mode or cell
  exit                  Shutdown engine

Cell:
  /memory               Show active memory context
  /memory full          Show full memory files
  /thoughts             Show recent thoughts
  /feed <content>       Append knowledge to current cell
  /write <task>         Ask current cell to create a workspace markdown file
  /read <file>          Read a workspace file
  /revise <file> <task> Revise a workspace file
  /share <file> <cell>  Share file to another cell
  /import <cell> <file> Import file from another cell
  /workspace            List workspace files
  /snapshot             Create snapshot
  /snapshots            List snapshots
  /restore <name>       Restore snapshot
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