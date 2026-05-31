// merlin-cell.js
import fs from "fs/promises";
import path from "path";
import { createMerlinAssistant } from "./merlin-ai.js";
import {
  renderError,
  renderSkill,
  renderSkillNotFound,
  writeAssistantChunk,
} from "./merlin-ui.js";

export class MerlinCell {
  constructor({
    id = "cell-001",
    name = "Merlin Cell",
    model = "gpt-4.1",
  } = {}) {
    this.id = id;
    this.name = name;
    this.model = model;

    this.rootDir = path.join("cells", this.id);
    this.logsDir = path.join(this.rootDir, "logs");
    this.memoryDir = path.join(this.rootDir, "memory");
    this.workspaceDir = path.join(this.rootDir, "workspace");
    this.snapshotsDir = path.join(this.rootDir, "snapshots");
    this.cellFile = path.join(this.rootDir, "cell.json");

    this.memoryFiles = {
      identity: path.join(this.memoryDir, "identity.md"),
      rules: path.join(this.memoryDir, "rules.md"),
      knowledge: path.join(this.memoryDir, "knowledge.md"),
      history: path.join(this.memoryDir, "history.md"),
    };

    this.assistant = null;
  }

  async prepare() {
    await this.prepareCellDirectory();
    await this.prepareMemoryFiles();

    this.assistant = await createMerlinAssistant({
      model: this.model,
      onDelta: writeAssistantChunk,
      onError: renderError,
      logDir: this.logsDir,
      cellId: this.id,
      cellName: this.name,
    });

    await this.updateStatus("idle");
  }

  async ask(input) {
    if (!this.assistant) {
      throw new Error(`Cell ${this.id} has not been prepared.`);
    }

    await this.updateStatus("running");

    try {
      const memoryContext = await this.readMemoryContext();

      const cellInput = `
# Merlin Cell Context

## Cell
- id: ${this.id}
- name: ${this.name}

## Memory

${memoryContext}

---

# User Input

${input}
`;

      const result = await this.askWithTimeout(cellInput, 60000);

      await this.appendHistory(`## ${new Date().toISOString()}

### User
${input}

### Result
${result?.text ?? result?.answer ?? "(response streamed)"}
`);

      if (result.usedSkill) {
        renderSkill(result.usedSkill);
      }

      if (result.skillMissing) {
        renderSkillNotFound(result.skillMissing);
      }

      await this.increaseMaturity(1);
      await this.updateStatus("idle");

      return result;
    } catch (error) {
      await this.updateStatus("error");
      throw error;
    }
  }

  async askWithTimeout(input, timeoutMs = 60000) {
    return await Promise.race([
      this.assistant.ask(input),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${timeoutMs}ms waiting for AI response`)),
          timeoutMs
        )
      ),
    ]);
  }

  async prepareCellDirectory() {
    await Promise.all([
      fs.mkdir(this.logsDir, { recursive: true }),
      fs.mkdir(this.memoryDir, { recursive: true }),
      fs.mkdir(this.workspaceDir, { recursive: true }),
      fs.mkdir(this.snapshotsDir, { recursive: true }),
    ]);

    const now = new Date().toISOString();

    const defaultProfile = {
      id: this.id,
      name: this.name,
      model: this.model,
      status: "idle",
      maturity: 0,
      createdAt: now,
      updatedAt: now,
      lastStartedAt: now,
      directories: {
        root: this.rootDir,
        logs: this.logsDir,
        memory: this.memoryDir,
        workspace: this.workspaceDir,
        snapshots: this.snapshotsDir,
      },
    };

    const existingProfile = await this.readCellProfile();

    const nextProfile = existingProfile
      ? {
          ...existingProfile,
          name: existingProfile.name || this.name,
          model: this.model,
          status: "idle",
          updatedAt: now,
          lastStartedAt: now,
          directories: defaultProfile.directories,
        }
      : defaultProfile;

    await this.writeCellProfile(nextProfile);
  }

  async prepareMemoryFiles() {
    await this.ensureFile(
      this.memoryFiles.identity,
      `# Identity

I am ${this.name}.
My cell id is ${this.id}.

`
    );

    await this.ensureFile(
      this.memoryFiles.rules,
      `# Rules

- Use Traditional Chinese.
- Be concise, clear, and useful.
- Preserve Merlin Platform context.
- Grow through memory, workspace, and snapshots.

`
    );

    await this.ensureFile(
      this.memoryFiles.knowledge,
      `# Knowledge

`
    );

    await this.ensureFile(
      this.memoryFiles.history,
      `# History

`
    );
  }

  async ensureFile(file, content = "") {
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(file, content, "utf8");
    }
  }

  async readCellProfile() {
    try {
      const raw = await fs.readFile(this.cellFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async writeCellProfile(profile) {
    await fs.writeFile(this.cellFile, JSON.stringify(profile, null, 2), "utf8");
  }

  async updateStatus(status) {
    try {
      const profile = await this.readCellProfile();

      if (!profile) return;

      profile.status = status;
      profile.updatedAt = new Date().toISOString();

      await this.writeCellProfile(profile);
    } catch {
      // cell.json 寫入失敗不應該中斷 CLI
    }
  }

  async increaseMaturity(amount = 1) {
    try {
      const profile = await this.readCellProfile();

      if (!profile) return;

      profile.maturity = Number(profile.maturity ?? 0) + amount;
      profile.updatedAt = new Date().toISOString();

      await this.writeCellProfile(profile);
    } catch {
      // maturity 更新失敗不應該中斷 CLI
    }
  }

  // =========================
  // Memory
  // =========================

  async readMemoryContext() {
    const sections = [];

    for (const [name, file] of Object.entries(this.memoryFiles)) {
      try {
        const content = await fs.readFile(file, "utf8");
        sections.push(`## ${name}\n\n${content}`);
      } catch {
        sections.push(`## ${name}\n\n`);
      }
    }

    return sections.join("\n\n---\n\n");
  }

  async readMemory(name = "knowledge") {
    const file = this.resolveMemoryFile(name);
    return await fs.readFile(file, "utf8");
  }

  async writeMemory(name, content) {
    const file = this.resolveMemoryFile(name);
    await fs.writeFile(file, content, "utf8");
  }

  async appendMemory(name, content) {
    const file = this.resolveMemoryFile(name);
    await fs.appendFile(file, `\n${content}\n`, "utf8");
  }

  async appendKnowledge(content) {
    await this.appendMemory("knowledge", content);
  }

  async appendHistory(content) {
    await this.appendMemory("history", content);
  }

  resolveMemoryFile(name) {
    const file = this.memoryFiles[name];

    if (!file) {
      throw new Error(`Unknown memory file: ${name}`);
    }

    return file;
  }

  // =========================
  // Workspace
  // =========================

  async listWorkspace() {
    return await this.listDirectoryRecursive(this.workspaceDir);
  }

  async writeWorkspaceFile(relativePath, content) {
    const file = this.resolveInside(this.workspaceDir, relativePath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, "utf8");
  }

  async readWorkspaceFile(relativePath) {
    const file = this.resolveInside(this.workspaceDir, relativePath);
    return await fs.readFile(file, "utf8");
  }

  async appendWorkspaceFile(relativePath, content) {
    const file = this.resolveInside(this.workspaceDir, relativePath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, `\n${content}\n`, "utf8");
  }

  // =========================
  // Snapshots
  // =========================

  async createSnapshot(name = null) {
    const timestamp = this.formatTimestamp(new Date());
    const snapshotName = name || `snapshot-${timestamp}`;
    const snapshotDir = path.join(this.snapshotsDir, snapshotName);

    await fs.mkdir(snapshotDir, { recursive: true });

    await this.copyDirectory(this.memoryDir, path.join(snapshotDir, "memory"));
    await this.copyDirectory(
      this.workspaceDir,
      path.join(snapshotDir, "workspace")
    );

    await fs.copyFile(this.cellFile, path.join(snapshotDir, "cell.json"));

    const manifest = {
      cellId: this.id,
      snapshot: snapshotName,
      createdAt: new Date().toISOString(),
      includes: ["cell.json", "memory", "workspace"],
    };

    await fs.writeFile(
      path.join(snapshotDir, "snapshot.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );

    return snapshotName;
  }

  async listSnapshots() {
    try {
      const entries = await fs.readdir(this.snapshotsDir, {
        withFileTypes: true,
      });

      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  async restoreSnapshot(snapshotName) {
    if (!snapshotName) {
      throw new Error("Snapshot name is required.");
    }

    const snapshotDir = path.join(this.snapshotsDir, snapshotName);

    await fs.access(snapshotDir);

    await fs.rm(this.memoryDir, { recursive: true, force: true });
    await fs.rm(this.workspaceDir, { recursive: true, force: true });

    await this.copyDirectory(path.join(snapshotDir, "memory"), this.memoryDir);
    await this.copyDirectory(
      path.join(snapshotDir, "workspace"),
      this.workspaceDir
    );

    try {
      await fs.copyFile(path.join(snapshotDir, "cell.json"), this.cellFile);
    } catch {
      // 舊 snapshot 可能沒有 cell.json，忽略
    }

    await this.updateStatus("idle");
  }

  // =========================
  // Utils
  // =========================

  async listDirectoryRecursive(dir, baseDir = dir) {
    const result = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          result.push(`${relativePath}/`);
          result.push(...(await this.listDirectoryRecursive(fullPath, baseDir)));
        } else {
          result.push(relativePath);
        }
      }
    } catch {
      return result;
    }

    return result;
  }

  async copyDirectory(source, target) {
    await fs.mkdir(target, { recursive: true });

    try {
      const entries = await fs.readdir(source, { withFileTypes: true });

      for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);

        if (entry.isDirectory()) {
          await this.copyDirectory(sourcePath, targetPath);
        } else {
          await fs.copyFile(sourcePath, targetPath);
        }
      }
    } catch {
      // source 不存在時，建立空目錄即可
    }
  }

  resolveInside(baseDir, relativePath) {
    const resolved = path.resolve(baseDir, relativePath);
    const base = path.resolve(baseDir);

    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new Error(`Invalid path outside cell directory: ${relativePath}`);
    }

    return resolved;
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

  async shutdown() {
    await this.updateStatus("stopped");
    await this.assistant?.cleanup();
  }
}