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
    this.thoughtsDir = path.join(this.rootDir, "thoughts");
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
      const memoryContext = await this.buildMemoryContext(input);

      const cellInput = `
# Merlin Cell Context

## Cell
- id: ${this.id}
- name: ${this.name}
- model: ${this.model}

## Memory

${memoryContext}

---

# User Input

${input}
`;

      const result = await this.askWithTimeout(cellInput, 60000);
      const outputText = result?.text ?? result?.answer ?? "(response streamed)";

      await this.appendHistory(`## ${new Date().toISOString()}

### User
${input}

### Result
${outputText}
`);

      await this.reflect({
        input,
        output: outputText,
      });

      if (result.usedSkill) {
        renderSkill(result.usedSkill);
      }

      if (result.skillMissing) {
        renderSkillNotFound(result.skillMissing);
      }

      await this.mature(1);
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
          () =>
            reject(
              new Error(`Timeout after ${timeoutMs}ms waiting for AI response`)
            ),
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
      fs.mkdir(this.thoughtsDir, { recursive: true }),
    ]);

    const now = new Date().toISOString();

const defaultProfile = {
  id: this.id,
  name: this.name,
  model: this.model,

  status: "idle",
  maturity: 0,
  generation: 1,
  parent: null,

  responsibilities: [],
  relationships: [],

  createdAt: now,
  updatedAt: now,
  lastStartedAt: now,

  directories: {
    root: this.rootDir,
    logs: this.logsDir,
    memory: this.memoryDir,
    workspace: this.workspaceDir,
    snapshots: this.snapshotsDir,
    thoughts: this.thoughtsDir,
  },
};

    const existingProfile = await this.readCellProfile();

    const nextProfile = existingProfile
    ? {
        ...existingProfile,
        name: existingProfile.name || this.name,
        model: this.model,
        status: "idle",

        generation:
          existingProfile.generation ?? 1,

        parent:
          existingProfile.parent ?? null,

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
- Grow through memory, workspace, thoughts, and snapshots.
- Do not treat history as absolute truth; summarize and refine it into knowledge.

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
      // cell.json 寫入失敗不應中斷 CLI
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
      // maturity 更新失敗不應中斷 CLI
    }
  }

  async getProfile() {
  return (await this.readCellProfile()) || {};
}

async getStatus() {
  const profile = await this.readCellProfile();
  return profile?.status ?? "unknown";
}

async getMaturity() {
  const profile = await this.readCellProfile();
  return Number(profile?.maturity ?? 0);
}

async mature(amount = 1) {
  await this.increaseMaturity(amount);

  return {
    maturity: await this.getMaturity(),
  };
}

async canDivide() {
  return (await this.getMaturity()) >= 5;
}

async setGeneration(generation) {
  const profile = await this.readCellProfile();

  if (!profile) return;

  profile.generation = generation;
  profile.updatedAt = new Date().toISOString();

  await this.writeCellProfile(profile);
}

async setParent(parentId) {
  const profile = await this.readCellProfile();

  if (!profile) return;

  profile.parent = parentId;
  profile.updatedAt = new Date().toISOString();

  await this.writeCellProfile(profile);
}

async getEvolutionInfo() {
  const profile = await this.readCellProfile();

  return {
    id: profile?.id,
    status: profile?.status,
    maturity: Number(profile?.maturity ?? 0),
    generation: Number(profile?.generation ?? 1),
    parent: profile?.parent ?? null,
  };
}

async addResponsibility(name) {

  const profile =
    await this.readCellProfile();

  if (!profile) return;

  profile.responsibilities ??= [];

  if (
    !profile.responsibilities.includes(name)
  ) {
    profile.responsibilities.push(name);
  }

  await this.writeCellProfile(profile);
}

async removeResponsibility(name) {

  const profile =
    await this.readCellProfile();

  if (!profile) return;

  profile.responsibilities =
    (profile.responsibilities ?? [])
      .filter(item => item !== name);

  await this.writeCellProfile(profile);
}

async listResponsibilities() {

  const profile =
    await this.readCellProfile();

  return profile?.responsibilities ?? [];
}

async addRelationship(
  type,
  target
) {

  const profile =
    await this.readCellProfile();

  if (!profile) return;

  profile.relationships ??= [];

  profile.relationships.push({
    type,
    target
  });

  await this.writeCellProfile(profile);
}

async listRelationships() {

  const profile =
    await this.readCellProfile();

  return profile?.relationships ?? [];
}

  // =========================
  // Memory
  // =========================

  async buildMemoryContext(input = "") {
    const identity = await this.safeReadMemory("identity");
    const rules = await this.safeReadMemory("rules");
    const knowledge = await this.safeReadMemory("knowledge");
    const recentHistory = await this.readRecentHistory(8000);
    const recentThoughts = await this.readRecentThoughts(4000);

    return `
## Identity

${identity}

---

## Rules

${rules}

---

## Knowledge

${knowledge}

---

## Recent History

${recentHistory}

---

## Recent Thoughts

${recentThoughts}

---

## Current Task Hint

${input}
`;
  }

  async readMemoryContext() {
    return await this.buildMemoryContext();
  }

  async safeReadMemory(name) {
    try {
      return await this.readMemory(name);
    } catch {
      return "";
    }
  }

  async readRecentHistory(maxChars = 8000) {
    try {
      const content = await this.readMemory("history");
      return this.tail(content, maxChars);
    } catch {
      return "";
    }
  }

  async readRecentThoughts(maxChars = 4000) {
    try {
      const files = await fs.readdir(this.thoughtsDir);
      const markdownFiles = files
        .filter((file) => file.endsWith(".md"))
        .sort()
        .slice(-5);

      const contents = [];

      for (const file of markdownFiles) {
        const fullPath = path.join(this.thoughtsDir, file);
        const content = await fs.readFile(fullPath, "utf8");
        contents.push(`# ${file}\n\n${content}`);
      }

      return this.tail(contents.join("\n\n---\n\n"), maxChars);
    } catch {
      return "";
    }
  }

  async reflect({ input, output }) {
    try {
      const reflectionPrompt = `
你是 ${this.name} 的自我反思模組。

請根據本次互動，產生一段「可長期保存」的細胞記憶。

請只輸出 Markdown，並分成三段：

## Learned
本次學到什麼。

## Useful Pattern
未來可重複使用的模式。

## Next Growth
這個 Cell 下一步可以如何成長。

---

# User Input

${input}

---

# Cell Output

${output}
`;

      const result = await this.askWithTimeout(reflectionPrompt, 30000);
      const reflection = result?.text ?? result?.answer ?? "";

      if (!reflection.trim()) return;

      const timestamp = new Date().toISOString();

      await this.appendThought(`## ${timestamp}

${reflection}
`);

      await this.appendKnowledge(`## Learned at ${timestamp}

${reflection}
`);
    } catch {
      // reflection 失敗不應中斷主要任務
    }
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

  async appendThought(content) {
    const file = path.join(
      this.thoughtsDir,
      `${this.formatTimestamp(new Date())}.md`
    );

    await fs.writeFile(file, content, "utf8");
  }

  resolveMemoryFile(name) {
    const file = this.memoryFiles[name];

    if (!file) {
      throw new Error(`Unknown memory file: ${name}`);
    }

    return file;
  }

  // =========================
  // Thinking
  // =========================

  async think() {
    const profile = await this.getProfile();
    const memoryContext = await this.buildMemoryContext();

    const prompt = `
  你是 ${this.name} 的自我思考模組。

  請根據目前 Cell 狀態，產生一份「成長反思」。

  請輸出 Markdown，包含：

  ## Current State
  目前狀態。

  ## Observed Pattern
  最近觀察到的模式。

  ## Growth Direction
  下一步成長方向。

  ## Suggested Action
  建議行動。

  ---

  # Profile

  ${JSON.stringify(profile, null, 2)}

  ---

  # Memory Context

  ${memoryContext}
  `;

    const result = await this.askWithTimeout(prompt, 60000);
    const thought = result?.text ?? result?.answer ?? "";

    if (!thought.trim()) {
      throw new Error("No thought generated.");
    }

    await this.appendThought(`## ${new Date().toISOString()}

  ${thought}
  `);

    await this.increaseMaturity(1);

    return thought.trim();
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
    await this.copyDirectory(this.workspaceDir, path.join(snapshotDir, "workspace"));
    await this.copyDirectory(this.thoughtsDir, path.join(snapshotDir, "thoughts"));

    await fs.copyFile(this.cellFile, path.join(snapshotDir, "cell.json"));

    const manifest = {
      cellId: this.id,
      snapshot: snapshotName,
      createdAt: new Date().toISOString(),
      includes: ["cell.json", "memory", "workspace", "thoughts"],
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
    await fs.rm(this.thoughtsDir, { recursive: true, force: true });

    await this.copyDirectory(path.join(snapshotDir, "memory"), this.memoryDir);
    await this.copyDirectory(path.join(snapshotDir, "workspace"), this.workspaceDir);
    await this.copyDirectory(path.join(snapshotDir, "thoughts"), this.thoughtsDir);

    try {
      await fs.copyFile(path.join(snapshotDir, "cell.json"), this.cellFile);
    } catch {
      // 舊 snapshot 可能沒有 cell.json
    }

    await this.updateStatus("idle");
  }

  // =========================
  // Cell Lifecycle
  // =========================

  async divide(childId) {
    if (!childId) {
      throw new Error("Child cell id is required.");
    }

    if (!(await this.canDivide())) {
      throw new Error(
        `Cell ${this.id} is not mature enough to divide. maturity=${await this.getMaturity()}`
      );
    }

    const childRootDir = path.join("cells", childId);

    await fs.mkdir(childRootDir, { recursive: true });

    await this.copyDirectory(this.memoryDir, path.join(childRootDir, "memory"));
    await this.copyDirectory(this.workspaceDir, path.join(childRootDir, "workspace"));

    const parentProfile = await this.readCellProfile();

    const childProfile = {
      ...parentProfile,
      id: childId,
      name: childId,
      status: "idle",
      maturity: 0,
      generation: Number(parentProfile?.generation ?? 1) + 1,
      parent: this.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastStartedAt: null,
      responsibilities: [],
      relationships: [
        {
          type: "born-from",
          target: this.id,
        },
      ],
      directories: {
        root: childRootDir,
        logs: path.join(childRootDir, "logs"),
        memory: path.join(childRootDir, "memory"),
        workspace: path.join(childRootDir, "workspace"),
        snapshots: path.join(childRootDir, "snapshots"),
        thoughts: path.join(childRootDir, "thoughts"),
      },
    };

    await fs.mkdir(childProfile.directories.logs, { recursive: true });
    await fs.mkdir(childProfile.directories.snapshots, { recursive: true });
    await fs.mkdir(childProfile.directories.thoughts, { recursive: true });

    await fs.writeFile(
      path.join(childRootDir, "cell.json"),
      JSON.stringify(childProfile, null, 2),
      "utf8"
    );

    await this.addRelationship("divided-into", childId);

    return childProfile;
  }

  // =========================
  // Utils
  // =========================

  tail(content, maxChars = 8000) {
    if (!content) return "";
    return content.length > maxChars ? content.slice(-maxChars) : content;
  }

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