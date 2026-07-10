// cradle-cell.js
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createCradleAssistant } from "./cradle-ai.js";
import { createCopilotProvider } from "./providers/copilot-provider.js";
import { createOllamaProvider } from "./providers/ollama-provider.js";
import { block } from "./utils/text.js";
import { parseLooseJsonObject } from "./utils/json.js";
import {
  renderError,
  renderSkill,
  renderSkillNotFound,
  writeAssistantChunk,
} from "./cradle-console.js";
import {
  calculateTraitValue,
  calculateCellScore,
} from "./dna/dna-measure.js";
import {
  dnaVectorToMatrix,
} from "./dna/dna-matrix.js";
import {
  createDivisionPlanFromMatrix,
} from "./dna/dna-division.js";
import {
  calculateDNAMaturityFromHistory,
} from "./dna/dna-maturity.js";
import {
  calculateCrossTraitVariance,
  findDominantTrait,
  decideCellLifecycle,
} from "./dna/dna-lifecycle.js";
import { ArtifactProductionService } from "./production/artifact-production-service.js";
import { StabilityStore } from "./stability/stability-store.js";
import {
  createLivingContext,
  normalizeLivingContext,
} from "./living-context/living-context-schema.js";

export class CradleCell {

  constructor({
    id = "cell-001",
    name = "Cradle Cell",
    model = "gpt-5-mini",
    provider = "copilot",
  } = {}) {
    this.id = id;
    this.name = name;
    this.model = model;
    this.provider = provider;

    this.rootDir = path.join("cells", this.id);
    this.logsDir = path.join(this.rootDir, "logs");
    this.memoryDir = path.join(this.rootDir, "memory");
    this.dnaDir = path.join(this.rootDir, "dna");
    this.dnaDefinitionFile = path.join(process.cwd(), "config", "DNA_DEFINITION.md");
    this.dnaFactorsFile = path.join(process.cwd(), "config", "DNA_FACTORS.md");
    this.visionFile = path.join(process.cwd(), "config", "VISION.md");
    this.environmentFile = path.join(process.cwd(), "config", "ENVIRONMENT.md");
    this.dnaVectorFile = path.join(this.rootDir, "dna-vector.json");
    this.dnaHistoryFile = path.join(this.rootDir, "dna-history.json");
    this.workspaceDir = path.join(this.rootDir, "workspace");
    this.situationDir = path.join(process.cwd(), "situation");
    this.stimuliDir = path.join(this.situationDir, "stimuli");
    this.observationsDir = path.join(this.situationDir, "observations");
    this.metricsDir = path.join(this.situationDir, "metrics");
    this.productionsDir = path.join(this.workspaceDir, "productions");
    this.reviewsDir = path.join(this.workspaceDir, "reviews");
    this.publicationsDir = path.join(this.workspaceDir, "publications");
    this.workspaceDirs = {
      notes: path.join(this.workspaceDir, "notes"),
      tasks: path.join(this.workspaceDir, "tasks"),
      artifacts: path.join(this.workspaceDir, "artifacts"),
      projects: path.join(this.workspaceDir, "projects"),
      research: path.join(this.workspaceDir, "research"),
      decisions: path.join(this.workspaceDir, "decisions"),
      productions: this.productionsDir,
      reviews: this.reviewsDir,
      publications: this.publicationsDir,
    };
    this.snapshotsDir = path.join(this.rootDir, "snapshots");
    this.thoughtsDir = path.join(this.rootDir, "thoughts");
    this.cellFile = path.join(this.rootDir, "cell.json");
    this.inboxDir = path.join(this.rootDir, "inbox");
    this.inboxFile = path.join(this.inboxDir, "messages.json");
    this.tasksDir = path.join(this.rootDir, "tasks");
    this.tasksFile = path.join(this.tasksDir, "tasks.json");
    this.evolutionsDir = path.join(this.rootDir, "evolutions");
    this.evolutionStateFile = path.join(this.rootDir, "evolution-state.json");
    this.lifecycleEventsFile = path.join(this.rootDir, "lifecycle-events.json");
    this.livingContextFile = path.join(this.rootDir, "living-context.json");
    this.profileFile = path.join(this.rootDir, "profile.json");

    this.memoryFiles = {
      identity: path.join(this.memoryDir, "identity.md"),
      rules: path.join(this.memoryDir, "rules.md"),
      knowledge: path.join(this.memoryDir, "knowledge.md"),
      history: path.join(this.memoryDir, "history.md"),
    };

    this.assistant = null;

    this.active = false;
    this.tickTimer = null;
    this.tickIntervalMs = 10_000;
    this.isTicking = false;
    this.isEvolving = false;
  }

  async prepare() {
    await this.prepareCellDirectory();
    await this.ensureRootFiles();
    await this.prepareDNAFiles();
    await this.prepareDNAVector();
    await this.prepareMemoryFiles();
    await this.prepareLivingContext();

    const provider = await this.createProvider();

    this.assistant = await createCradleAssistant({
      provider,
      onDelta: writeAssistantChunk,
      onError: renderError,
      logDir: this.logsDir,
      cellId: this.id,
      cellName: this.name,
      systemPromptBuilder: async () => await this.buildCellSystemPrompt(),
    });

    this.productionService = new ArtifactProductionService({
      cell: this,
      assistant: this.assistant,
      productionsDir: this.productionsDir,
    });

    // 暴露 artifactStore 供其他服務使用
    this.artifactStore = this.productionService.store;

    this.stabilityStore = new StabilityStore({
      rootDir: this.rootDir,
    });

    await this.updateStatus("idle");
  }

  async createProvider() {
    
    if (this.provider === "ollama") {
      return createOllamaProvider({
        model: this.model,
      });
    }

    if (this.provider === "copilot") {
      return await createCopilotProvider({
        model: this.model,
      });
    }

    throw new Error(`Unsupported LLM provider: ${this.provider}`);
  }

  async activate() {
    if (this.active) {
      console.log(`Cell already active: ${this.id}`);
      return;
    }

    this.active = true;
    await this.updateStatus("active");

    this.tickTimer = setInterval(() => {
      this.tick().catch(async (error) => {
        console.log(`[${this.id}] tick failed: ${error.message}`);
        await this.updateStatus("error");
      });
    }, this.tickIntervalMs);

    console.log(`🟢 Cell activated: ${this.id}`);
  }

  async deactivate() {
    if (!this.active) {
      console.log(`Cell already inactive: ${this.id}`);
      return;
    }

    this.active = false;

    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    await this.updateStatus("idle");

    console.log(`⚪ Cell deactivated: ${this.id}`);
  }

  isActive() {
    return this.active;
  }

  async tick() {
    console.log(`🫀 ${this.id} heartbeat`);

    if (this.isTicking) {
      console.log(`  ${this.id} skipped: already ticking`);

      return {
        skipped: true,
        reason: "already ticking",
      };
    }

    this.isTicking = true;

    try {
      const inbox = await this.readInbox();

      if (inbox.length > 0) {
        console.log(`  ${this.id} processing inbox=${inbox.length}`);

        await this.updateStatus("running");

        const result = await this.processInbox(inbox);

        await this.clearInbox();

        await this.updateStatus(this.active ? "active" : "idle");

        return {
          type: "inbox",
          processed: result.processed ?? inbox.length,
        };
      }

      const task = await this.nextPendingTask();

      if (task) {
        console.log(`  ${this.id} processing task=${task.id}`);

        await this.updateStatus("running");

        const result = await this.processTask(task);

        await this.completeTask(task.id);

        await this.updateStatus(this.active ? "active" : "idle");

        return {
          type: "task",
          processed: 1,
          taskId: task.id,
          result,
        };
      }

      const metabolism = await this.metabolize();

      if (metabolism.created > 0) {
        console.log(`  ${this.id} metabolized stimuli, tasks=${metabolism.created}`);

        return {
          type: "metabolism",
          processed: metabolism.created,
          observationFile: metabolism.observationFile,
        };
      }

      const evolution = await this.evolve();

      if (evolution.evolved) {
        console.log(`  ${this.id} evolved from thoughts=${evolution.thoughtCount}`);

        return {
          type: "evolution",
          processed: evolution.thoughtCount,
          file: evolution.file,
        };
      }

      console.log(`  ${this.id} idle: no inbox, task, or stimuli`);

      return {
        processed: 0,
        reason: "no inbox, task, or stimuli",
      };
    } catch (error) {
      await this.updateStatus("error");
      throw error;
    } finally {
      this.isTicking = false;
    }
  }


  async processTask(task) {
    const result = await this.askWithTimeout(`
    你是 ${this.id}。

    請根據你的 DNA、Memory、Vision、Environment,處理以下任務。

    # Task

    ${task.title}

    # Content

    ${task.content || "(empty)"}

    請輸出：
    - 任務理解
    - 執行結果
    - 下一步建議
    `, 120000);

    const outputText =
      result?.text ??
      result?.answer ??
      "(response streamed)";

    const filename =
      `tasks/task-result-${this.formatTimestamp(new Date())}.md`;

    await this.writeWorkspaceFile(
      filename,
      `# Task Result

    ## Task

    ${task.title}

    ## Task ID

    ${task.id}

    ## Result

    ${outputText}

    ---
    createdAt: ${new Date().toISOString()}
    `
    );

    await this.appendHistory(
      block([
        `## ${new Date().toISOString()}`,
        "",
        "### Task",
        task.title,
        "",
        "### Result",
        outputText,
        "",
      ])
    );


    await this.appendThought(
      block([
        `## ${new Date().toISOString()}`,
        "",
        "## Task Experience",
        "",
        "### Task",
        task.title,
        "",
        "### Source",
        task.source,
        "",
        "### Result Summary",
        outputText,
        "",
        "### Growth Impact",
        "This task changed how the cell understands its environment and future work.",
        "",
      ])
    );

    await this.mature(1);

    return {
      file: filename,
      text: outputText,
    };
  }

  formatObservationMarkdown(observation) {
    if (!observation) {
      return "(empty)";
    }

    if (typeof observation === "string") {
      return observation;
    }

    const lines = [];

    lines.push("## Summary");
    lines.push("");
    lines.push(observation.summary ?? "(empty)");
    lines.push("");

    lines.push("## Facts");
    lines.push("");
    for (const item of observation.facts ?? []) {
      lines.push(`- ${item}`);
    }
    lines.push("");

    lines.push("## Interpretations");
    lines.push("");
    for (const item of observation.interpretations ?? []) {
      lines.push(`- ${item}`);
    }
    lines.push("");

    lines.push("## Hypotheses");
    lines.push("");
    for (const item of observation.hypotheses ?? []) {
      lines.push(`- ${item}`);
    }
    lines.push("");

    lines.push("## Unknowns");
    lines.push("");
    for (const item of observation.unknowns ?? []) {
      lines.push(`- ${item}`);
    }
    lines.push("");

    lines.push("## Next Actions");
    lines.push("");
    for (const item of observation.nextActions ?? []) {
      lines.push(`- ${item}`);
    }
    lines.push("");

    return lines.join("\n");
  }

  async metabolize() {
    const stimuli = await this.readStimuli();

    if (stimuli.length === 0) {
      return {
        created: 0,
        reason: "no stimuli",
      };
    }

    const result = await this.askWithTimeout(`
你是 ${this.id}。

請根據目前的 DNA、Memory、Vision、Environment,觀察 situation stimuli。

請判斷是否需要建立新的 task。

# Perception Discipline

Cradle Cell 可以根據 Stimuli 形成觀察、解讀與假設,但必須保持層次清楚。

## Rules

- Facts 必須只來自 Stimuli 中明確出現的內容。
- Interpretations 可以基於 Facts 做合理解讀,但不可寫成已確認結論。
- Hypotheses 可以提出可能原因,但必須標示為未確認,且不可直接變成 Task。
- Unknowns 用來保存目前無法判斷的部分,不可用想像填補。
- Next Actions 應該是取得更多 evidence 或驗證假設,而不是直接進行大型改善。
- Tasks 只在 Stimuli 顯示明確失敗、風險、矛盾、壓力或未完成目標時產生。
- 如果 Stimuli 只有成功結果,通常只形成 Observation,不建立 Task。
- 如果需要建立 Task,應優先建立「驗證型任務」,而不是「修復型任務」。
- 每次 metabolize 預設最多建立 1 個 Task,除非 Stimuli 明確包含多個獨立問題。
- 如果 Stimuli 只有成功結果，通常只形成 Observation，不建立 Task。
- 對於只有成功結果的 Stimuli，Next Actions 應保持最小化；可以是「記錄此次結果」、「作為後續比較基準」或空陣列。
- 不可因單次成功結果，自動提出完整測試、整合測試、CI/CD、部署、合併、監控或發布相關行動，除非 Stimuli 明確提供相關上下文。

# Cell Context

${await this.buildMemoryContext()}

# Stimuli

${stimuli.map((s) => `
## ${s.category}/${s.file}

${s.content}
`).join("\n\n")}

請輸出 JSON,不要 markdown,不要 code fence。

格式：
{
  "observation": {
    "summary": "整體觀察摘要",
    "facts": [
      "只列出 Stimuli 明確提供的事實"
    ],
    "interpretations": [
      "基於 facts 的合理解讀,不可寫成已確認結論"
    ],
    "hypotheses": [
      "可能原因或可能方向,必須標示未確認"
    ],
    "unknowns": [
      "目前無法判斷或 evidence 不足的部分"
    ],
    "nextActions": [
      "取得更多 evidence 或驗證假設的下一步"
    ]
  },
  "tasks": [
    {
      "title": "任務標題",
      "content": "任務內容"
    }
  ]
}
`, 120000);

    const raw =
      result?.text ??
      result?.answer ??
      result ??
      "{}";

    const parsed = parseLooseJsonObject(raw);

    const observationFile =
      `observation-${this.formatTimestamp(new Date())}.md`;

    await fs.writeFile(
      path.join(this.observationsDir, observationFile),
      `# Observation

${this.formatObservationMarkdown(parsed.observation)}

---
createdAt: ${new Date().toISOString()}
`,
      "utf8"
    );

    const tasks = parsed.tasks ?? [];

    for (const task of tasks) {
      await this.addTask({
        title: task.title,
        source: "metabolism",
        content: task.content ?? task.title,
      });
    }

    await this.archiveStimuli(stimuli);

    return {
      created: tasks.length,
      observationFile,
    };
  }


  async ask(input) {
    if (!this.assistant) {
      throw new Error(`Cell ${this.id} has not been prepared.`);
    }

    await this.updateStatus("running");

    try {
      const recentHistory = await this.readRecentHistory(4000);
      const recentThoughts = await this.readRecentThoughts(2000);

      const cellInput = `
# Cell Runtime Context

- id: ${this.id}
- name: ${this.name}
- model: ${this.model}

---

# Recent History

${recentHistory}

---

# Recent Thoughts

${recentThoughts}

---

# User Input

${input}
`;

      const result = await this.askWithTimeout(cellInput, 60000);
      const outputText = result?.text ?? result?.answer ?? "(response streamed)";

      await this.appendHistory(
        block([
          `## ${new Date().toISOString()}`,
          "",
          "### User",
          input,
          "",
          "### Result",
          outputText,
          "",
        ])
      );

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
      fs.mkdir(this.dnaDir, { recursive: true }),
      fs.mkdir(this.workspaceDir, { recursive: true }),
      fs.mkdir(this.workspaceDirs.notes, { recursive: true }),
      fs.mkdir(this.workspaceDirs.tasks, { recursive: true }),
      fs.mkdir(this.workspaceDirs.artifacts, { recursive: true }),
      fs.mkdir(this.workspaceDirs.projects, { recursive: true }),
      fs.mkdir(this.workspaceDirs.research, { recursive: true }),
      fs.mkdir(this.workspaceDirs.decisions, { recursive: true }),
      fs.mkdir(this.productionsDir, { recursive: true }),
      fs.mkdir(this.reviewsDir, { recursive: true }),
      fs.mkdir(this.publicationsDir, { recursive: true }),
      fs.mkdir(this.snapshotsDir, { recursive: true }),
      fs.mkdir(this.thoughtsDir, { recursive: true }),
      fs.mkdir(this.inboxDir, { recursive: true }),
      fs.mkdir(this.tasksDir, { recursive: true }),
      fs.mkdir(this.evolutionsDir, { recursive: true }),
      fs.mkdir(this.situationDir, { recursive: true }),
      fs.mkdir(this.stimuliDir, { recursive: true }),
      fs.mkdir(path.join(this.stimuliDir, "signals"), { recursive: true }),
      fs.mkdir(path.join(this.stimuliDir, "threats"), { recursive: true }),
      fs.mkdir(path.join(this.stimuliDir, "pressures"), { recursive: true }),
      fs.mkdir(path.join(this.stimuliDir, "resources"), { recursive: true }),
      fs.mkdir(path.join(this.stimuliDir, "processed"), { recursive: true }),
      fs.mkdir(this.observationsDir, { recursive: true }),
      fs.mkdir(this.metricsDir, { recursive: true }),
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
        dna: this.dnaDir,
        workspace: this.workspaceDir,
        workspaceDirs: this.workspaceDirs,
        snapshots: this.snapshotsDir,
        thoughts: this.thoughtsDir,
        inbox: this.inboxDir,
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


  async readTasks() {
    try {
      const raw = await fs.readFile(this.tasksFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async writeTasks(tasks = []) {
    await fs.mkdir(this.tasksDir, { recursive: true });
    await fs.writeFile(
      this.tasksFile,
      JSON.stringify(tasks, null, 2),
      "utf8"
    );
  }

  async addTask({ title, source = "manual", content = "" }) {
    const tasks = await this.readTasks();

    const task = {
      id: `task-${this.formatTimestamp(new Date())}-${crypto.randomUUID().slice(0, 8)}`,
      title,
      source,
      content,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(task);
    await this.writeTasks(tasks);

    return task;
  }

  async completeTask(taskId) {
    const tasks = await this.readTasks();

    for (const task of tasks) {
      if (task.id === taskId) {
        task.status = "done";
        task.updatedAt = new Date().toISOString();
      }
    }

    await this.writeTasks(tasks);
  }

  async nextPendingTask() {
    const tasks = await this.readTasks();
    return tasks.find((task) => task.status === "pending") ?? null;
  }

  /**
   * Read lifecycle events history
   * @returns {Promise<Array>} Array of lifecycle events
   */
  async readLifecycleEvents() {
    try {
      const raw = await fs.readFile(this.lifecycleEventsFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Append a lifecycle event to history
   * @param {Object} event - Event to append
   * @returns {Promise<void>}
   */
  async appendLifecycleEvent(event = {}) {
    const events = await this.readLifecycleEvents();

    events.push({
      at: new Date().toISOString(),
      ...event,
    });

    await fs.writeFile(
      this.lifecycleEventsFile,
      JSON.stringify(events, null, 2),
      "utf8"
    );
  }

  async readDNADefinition() {
    try {
      const content = await fs.readFile(this.dnaDefinitionFile, "utf8");

      const matches = [...content.matchAll(/^##\s+([A-Z0-9_-]+)\s*$/gm)];

      return matches.map((match) => {
        const name = match[1].trim();

        return {
          name,
          fileName: `${name.toLowerCase()}.md`,
        };
      });
    } catch {
      return [
        { name: "PERCEPTION", fileName: "perception.md" },
        { name: "DECISION", fileName: "decision.md" },
        { name: "DECOMPOSITION", fileName: "decomposition.md" },
        { name: "LEARNING", fileName: "learning.md" },
        { name: "COLLABORATION", fileName: "collaboration.md" },
        { name: "CREATION", fileName: "creation.md" },
        { name: "EVOLUTION", fileName: "evolution.md" },
      ];
    }
  }

  async getDNAFiles() {
    const definitions = await this.readDNADefinition();

    return Object.fromEntries(
      definitions.map((definition) => [
        definition.name,
        path.join(this.dnaDir, definition.fileName),
      ])
    );
  }

  async readDNAFactors() {
    try {
      const content = await fs.readFile(this.dnaFactorsFile, "utf8");
      const matches = [...content.matchAll(/^##\s+([a-zA-Z0-9_-]+)\s*$/gm)];

      return matches.map((match) => match[1].trim());
    } catch {
      return ["strength", "stability", "plasticity"];
    }
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
      - Preserve Cradle Platform context.
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

  async ensureRootFiles() {
    await this.ensureFile(
      this.visionFile,
      `# VISION

建立一套電商系統。
`
    );

    await this.ensureFile(
      this.environmentFile,
      `# ENVIRONMENT

- Java 21
- Spring Boot
- Hexagonal Architecture
- MariaDB
`
    );
  }

  async prepareDNAFiles() {
    const definitions = await this.readDNADefinition();

    for (const definition of definitions) {
      const file = path.join(this.dnaDir, definition.fileName);

      await this.ensureFile(
        file,
        this.createDNASeed(definition.name)
      );
    }
  }

  createDNASeed(name) {
    return `# ${name} DNA

## Meaning

TODO: define meaning from DNA_DEFINITION.md.

## Traits

- TODO: define traits.

## Vector

\`\`\`json
{
  "strength": 0.5,
  "stability": 0.7,
  "plasticity": 0.3
}
\`\`\`
`;
  }

  async prepareDNAVector() {
    const definitions = await this.readDNADefinition();
    const factors = await this.readDNAFactors();

    const existing = await this.readDNAVector();

    const vector = existing ?? {};

    for (const definition of definitions) {
      vector[definition.name] ??= {};

      for (const factor of factors) {
        vector[definition.name][factor] ??= this.defaultDNAFactorValue(factor);
      }
    }

    await this.writeDNAVector(vector);
    await this.appendDNAHistory("prepare");
  }

  defaultDNAFactorValue(factor) {
    if (factor === "strength") return 0.5;
    if (factor === "stability") return 0.7;
    if (factor === "plasticity") return 0.3;
    return 0.5;
  }

  async readDNAVector() {
    try {
      const raw = await fs.readFile(this.dnaVectorFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async writeDNAVector(vector) {
    await fs.writeFile(
      this.dnaVectorFile,
      JSON.stringify(vector, null, 2),
      "utf8"
    );
  }

  async appendDNAHistory(reason = "unknown") {
    const vector = await this.readDNAVector();

    if (!vector) return;

    let history = [];

    try {
      const raw = await fs.readFile(this.dnaHistoryFile, "utf8");
      history = JSON.parse(raw);
    } catch {
      history = [];
    }

    history.push({
      at: new Date().toISOString(),
      reason,
      vector,
    });

    await fs.writeFile(
      this.dnaHistoryFile,
      JSON.stringify(history, null, 2),
      "utf8"
    );
  }

  /**
   * Append DNA history only if vector has changed
   * This prevents false maturity from appending identical vectors
   * which would artificially decrease temporal variance
   * @param {string} reason - Reason for the change
   * @returns {Promise<boolean>} True if appended, false if unchanged
   */
  async appendDNAHistoryIfChanged(reason = "unknown") {
    const vector = await this.readDNAVector();

    if (!vector) return false;

    const history = await this.readDNAHistory();
    const latest = history.at(-1)?.vector;

    // Compare vectors using JSON stringify
    if (JSON.stringify(latest) === JSON.stringify(vector)) {
      return false;
    }

    await this.appendDNAHistory(reason);
    return true;
  }

  async readDNAHistory() {
    try {
      const raw = await fs.readFile(
        this.dnaHistoryFile,
        "utf8"
      );

      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  clampDNAValue(value) {
    return Math.max(0, Math.min(1, value));
  }

  async applyDNADrift(dnaDrift = []) {
    const vector = await this.readDNAVector();

    if (!vector) return;

    for (const drift of dnaDrift) {
      const trait = String(drift.trait ?? "").toUpperCase();
      const factor = drift.factor;
      const delta = Number(drift.delta ?? 0);

      if (!trait || !factor) continue;

      vector[trait] ??= {};
      vector[trait][factor] ??= 0.5;

      vector[trait][factor] =
        this.clampDNAValue(Number(vector[trait][factor]) + delta);
    }

    await this.writeDNAVector(vector);
    await this.appendDNAHistory("evolution");
  }

  async calculateDNAVelocity(windowSize = 5) {
    let history = [];

    try {
      const raw = await fs.readFile(this.dnaHistoryFile, "utf8");
      history = JSON.parse(raw);
    } catch {
      return 1;
    }

    if (history.length < 2) {
      return 1;
    }

    const recent = history.slice(-windowSize);

    let totalDelta = 0;
    let count = 0;

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1].vector;
      const curr = recent[i].vector;

      for (const dnaKey of Object.keys(curr)) {
        for (const factor of Object.keys(curr[dnaKey] ?? {})) {
          const a = Number(prev?.[dnaKey]?.[factor] ?? 0);
          const b = Number(curr?.[dnaKey]?.[factor] ?? 0);

          totalDelta += Math.abs(b - a);
          count++;
        }
      }
    }

    if (count === 0) return 1;

    return totalDelta / count;
  }

  async calculateConvergence() {
    const velocity = await this.calculateDNAVelocity();

    const convergence = Math.max(0, Math.min(1, 1 - velocity));

    return {
      velocity,
      convergence,
      percent: Math.round(convergence * 100),
    };
  }

  parseEvolutionJson(raw = "{}") {
    try {
      return parseLooseJsonObject(raw);
    } catch {
      return {
        summary: "Evolution JSON parse failed.",
        dnaDrift: [],
        affinities: [],
      };
    }
  }

  async readLatestEvolution() {
    try {
      const files = await fs.readdir(
        this.evolutionsDir
      );

      const latest =
        files
          .filter(file => file.endsWith(".md"))
          .sort()
          .at(-1);

      if (!latest) {
        return null;
      }

      return await fs.readFile(
        path.join(
          this.evolutionsDir,
          latest
        ),
        "utf8"
      );
    } catch {
      return null;
    }
  }

  async evolve({ force = false } = {}) {
    if (this.isEvolving) {
      return {
        evolved: false,
        reason: "already evolving",
        thoughtCount: 0,
      };
    }

    this.isEvolving = true;

    try {
      const thoughts = await this.loadUnevolvedThoughts(5);

      if (!force && thoughts.length < 5) {
        return {
          evolved: false,
          reason: "not enough thoughts",
          thoughtCount: thoughts.length,
        };
      }

      if (thoughts.length === 0) {
        return {
          evolved: false,
          reason: "no thoughts",
          thoughtCount: 0,
        };
      }

      const dnaVector = await this.readDNAVector();

      const thoughtContext = thoughts
        .map((thought) => `
      ## ${thought.file}

      ${this.tail(thought.content, 1200)}
      `)
              .join("\n\n");

            const result = await this.askWithTimeout(`
      你是 ${this.id} 的 Evolution 模組。

      你的任務是：
      根據最近累積的 Thought，總結這個 Cell 的經驗，並產生小幅 DNA drift。

      請只輸出 JSON。
      不要 markdown。
      不要 code fence。
      不要額外說明。

      輸出格式如下：

      {
        "summary": "這次 evolution 的總結",
        "dnaDrift": [
          {
            "trait": "PERCEPTION",
            "factor": "fitness",
            "delta": 0.02,
            "reason": "原因"
          }
        ],
        "affinities": ["api", "product", "query"]
      }

      限制：
      - trait 只能是：PERCEPTION、DECISION、DECOMPOSITION、LEARNING、COLLABORATION、CREATION、EVOLUTION、REFLECTION
      - factor 只能是：strength、stability、plasticity、fitness
      - delta 必須介於 -0.05 到 0.05
      - 最多輸出 2 筆 dnaDrift
      - affinities 最多 5 個
      - 不要一次大幅改變 DNA
      - 如果沒有明確變化，dnaDrift 可以是空陣列

      DNA Drift Rules：
      - 只調整最能代表這批 thoughts 的 DNA trait。
      - 不要平均分配 drift 到多個 trait。
      - 優先讓 Cell 逐漸形成 specialization，而不是維持全能平衡。
      - 如果 thoughts 明顯偏向某一種能力，請集中強化該 trait。
      - 不相關的 trait 不要調整。
      - 重複出現的主題，應該強化同一個主要 trait。
      - strength 代表此 trait 對 Cell 行為的影響倍率。
      - fitness 代表此 trait 在目前環境中的平均有效性。
      - stability 代表此 trait 的可信度修正。
      - plasticity 代表此 trait 的波動程度或可塑性。

      # Current DNA Vector

      ${JSON.stringify(dnaVector, null, 2)}

      # Thoughts

      ${thoughtContext}
      `, 180000);

            const raw = result?.text ?? result?.answer ?? "{}";
            const evolution = this.parseEvolutionJson(raw);

            await this.applyDNADrift(evolution.dnaDrift ?? []);

            const filename =
              `evolution-${this.formatTimestamp(new Date())}.md`;

            await fs.writeFile(
              path.join(this.evolutionsDir, filename),
              `# Evolution

      ## Summary

      ${evolution.summary ?? "(empty)"}

      ## DNA Drift

      \`\`\`json
      ${JSON.stringify(evolution.dnaDrift ?? [], null, 2)}
      \`\`\`

      ## Affinities

      ${(evolution.affinities ?? []).map((item) => `- ${item}`).join("\n")}

      ## Thoughts

      ${thoughts.map((thought) => `- ${thought.file}`).join("\n")}

      ---
      createdAt: ${new Date().toISOString()}
      `,
        "utf8"
      );

      const state = await this.readEvolutionState();

      state.evolvedThoughts = [
        ...new Set([
          ...(state.evolvedThoughts ?? []),
          ...thoughts.map((thought) => thought.file),
        ]),
      ];

      state.evolutionCount = Number(state.evolutionCount ?? 0) + 1;
      state.lastEvolvedAt = new Date().toISOString();
      state.lastEvolutionFile = filename;

      await this.writeEvolutionState(state);

      return {
        evolved: true,
        file: filename,
        thoughtCount: thoughts.length,
        dnaDrift: evolution.dnaDrift ?? [],
        affinities: evolution.affinities ?? [],
      };
    } finally {
      this.isEvolving = false;
    }
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

  async readProfile() {
    try {
      const raw = await fs.readFile(this.profileFile, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
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

  /**
   * Legacy maturity counter (deprecated)
   * DNA maturity is now calculated from dna-history.json
   * Keep this for backward compatibility only
   */
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

  /**
   * Get maturity percentage (0-100) from DNA history
   * This replaces the old counter-based maturity in profile
   * @returns {Promise<number>} Maturity percentage
   */
  async getMaturity() {
    const maturity = await this.getMaturityInfo();
    return maturity.percent;
  }

  /**
   * Calculate DNA maturity from dna-history.json
   * Returns complete maturity information including:
   * - maturity: 0-1 score (normalizedMagnitude × convergence)
   * - percent: 0-100 percentage
   * - state: "seed" | "growing" | "stable" | "mature" | "saturated"
   * - sampleSize: number of DNA history entries analyzed
   * - magnitude: raw DNA capability score
   * - normalizedMagnitude: magnitude normalized to 0-1
   * - temporalVariance: variance of DNA vectors over time
   * - convergence: stability measure (1 / (1 + variance))
   * - currentTraitScores: latest trait scores
   */
  async getMaturityInfo() {
    const history = await this.readDNAHistory();

    return calculateDNAMaturityFromHistory(history, {
      windowSize: 5,
      varianceScale: 1,
      maxMagnitude: 8,
    });
  }

  /**
   * Get lifecycle decision based on DNA maturity and traits
   * Returns action recommendation: stay / repair / divide / merge
   * 
   * @param {Object} options - Decision options
   * @param {boolean} options.hasComplementaryCell - Whether complementary cell exists
   * @param {number} options.recentFailureRate - Recent failure rate (0-1)
   * @returns {Promise<Object>} Lifecycle decision with action, confidence, reason, detail
   */
  async getLifecycleDecision({
    hasComplementaryCell = false,
    recentFailureRate = 0,
  } = {}) {
    const maturityInfo = await this.getMaturityInfo();

    const traitScores =
      maturityInfo.currentTraitScores ?? {};

    const crossTraitVariance =
      calculateCrossTraitVariance(traitScores);

    const dominantTrait =
      findDominantTrait(traitScores);

    return decideCellLifecycle({
      maturityInfo,
      crossTraitVariance,
      dominantTrait,
      hasComplementaryCell,
      recentFailureRate,
    });
  }

  /**
   * Get current DNA maturity (no longer increases counter)
   * DNA maturity is now calculated from dna-history.json
   * @returns {Promise<Object>} Complete maturity information
   */
  async mature(amount = 1) {
    return await this.getMaturityInfo();
  }

  /**
   * Check if cell is mature enough to divide
   * Requirements:
   * - sampleSize >= 5: enough DNA history
   * - maturity >= 0.75: high enough maturity score
   * - temporalVariance <= 0.08: stable DNA pattern
   * - normalizedMagnitude >= 0.60: sufficient capability
   * @returns {Promise<boolean>} Can divide or not
   */
  async canDivide() {
    const maturity = await this.getMaturityInfo();

    return (
      maturity.sampleSize >= 5 &&
      maturity.maturity >= 0.75 &&
      maturity.temporalVariance <= 0.08 &&
      maturity.normalizedMagnitude >= 0.60
    );
  }

  /**
   * Assert cell can divide, throw detailed error if not
   * This provides comprehensive diagnostic information for debugging
   * @returns {Promise<Object>} Maturity info if can divide
   * @throws {Error} Detailed error message with all requirements
   */
  async assertCanDivide() {
    const maturity = await this.getMaturityInfo();

    const passed =
      maturity.sampleSize >= 5 &&
      maturity.maturity >= 0.75 &&
      maturity.temporalVariance <= 0.08 &&
      maturity.normalizedMagnitude >= 0.60;

    if (passed) {
      return maturity;
    }

    throw new Error(
      [
        `Cell ${this.id} is not mature enough to divide.`,
        "",
        `Maturity           : ${maturity.percent}%`,
        `State              : ${maturity.state}`,
        `Sample Size        : ${maturity.sampleSize}`,
        `Temporal Variance  : ${maturity.temporalVariance.toFixed(6)}`,
        `Convergence        : ${maturity.convergence.toFixed(4)}`,
        `NormalizedMagnitude: ${maturity.normalizedMagnitude.toFixed(4)}`,
        "",
        "Required:",
        "- sampleSize >= 5",
        "- maturity >= 75%",
        "- temporalVariance <= 0.08",
        "- normalizedMagnitude >= 0.60",
      ].join("\n")
    );
  }

  async divideTo(childCell) {
    await this.assertCanDivide();

    const parentInfo = await this.getEvolutionInfo();

    // 不再複製完整 memory，只建立結構性出生記錄
    // Memory 將由 Living Context Division Plan 的 childMemorySeed 提供

    await childCell.setParent(this.id);
    await childCell.setGeneration(parentInfo.generation + 1);

    // 建立最小 history
    await childCell.writeMemory(
      "history",
      block([
        "# History",
        "",
        `Born from ${this.id} at ${new Date().toISOString()}.`,
        "",
      ])
    );

    // 建立最小 thought
    await childCell.appendThought(
      block([
        `## ${new Date().toISOString()}`,
        "",
        `I was born from ${this.id}.`,
        "My Living Context defines my specialized responsibility.",
        "",
      ])
    );

    // 建立 relationships
    await this.addRelationship("divided-into", childCell.id);
    await childCell.addRelationship("born-from", this.id);

    await childCell.increaseMaturity(0);

    return {
      parent: this.id,
      child: childCell.id,
      generation: parentInfo.generation + 1,
    };
  }

  /**
   * 建立 DNA Division Plan（純規劃，不修改狀態）
   * 
   * @param {string} childId - Child Cell ID
   * @returns {Promise<Object>} DNA Division Plan
   */
  async createDivisionPlanBySVD(childId) {
    if (!childId) {
      throw new Error("Child cell id is required.");
    }

    await this.assertCanDivide();

    const dnaVector = await this.readDNAVector();

    if (!dnaVector) {
      throw new Error(`Cell ${this.id} has no dna-vector.json`);
    }

    const matrix = dnaVectorToMatrix(dnaVector);

    return createDivisionPlanFromMatrix(matrix, {
      parentId: this.id,
      childId,
    });
  }

  /**
   * 套用 DNA Division Plan（僅處理 DNA 部分）
   * 
   * @param {Object} childCell - Child Cell 實例
   * @param {Object} dnaDivisionPlan - DNA Division Plan
   * @returns {Promise<Object>} DNA Division 結果
   */
  async applyDivisionPlanBySVD(childCell, dnaDivisionPlan) {
    if (!childCell) {
      throw new Error("Child cell is required.");
    }
    if (!dnaDivisionPlan) {
      throw new Error("dnaDivisionPlan is required.");
    }

    // 1. 寫入 child DNA
    await childCell.writeDNAVector(dnaDivisionPlan.childDNAVector);
    await childCell.appendDNAHistory("svd-division-inheritance");

    // 2. Attenuate parent DNA
    await this.writeDNAVector(dnaDivisionPlan.parentDNAVector);
    await this.appendDNAHistory("svd-division-attenuation");

    // 3. 設定 Child role（如果存在）
    // Role 通常由 Living Context 處理，但為了向後相容保留
    
    // 4. 設定 generation
    const parentInfo = await this.getEvolutionInfo();
    await childCell.setGeneration(parentInfo.generation + 1);

    // 5. 設定 parent relationship
    await childCell.setParent(this.id);

    // 6. 建立 relationships
    await this.addRelationship("divided-into", childCell.id);
    await childCell.addRelationship("born-from", this.id);

    // 7. 記錄 Parent History
    await this.appendHistory(
      block([
        `## DNA Division`,
        "",
        `Child: ${childCell.id}`,
        `Reason: ${dnaDivisionPlan.reason}`,
        `Child role: ${dnaDivisionPlan.role}`,
        "",
      ])
    );

    // 8. 建立 Child History（基本出生記錄）
    await childCell.writeMemory(
      "history",
      block([
        "# History",
        "",
        `## Birth by DNA Division`,
        "",
        `Parent: ${this.id}`,
        `Role: ${dnaDivisionPlan.role}`,
        `Reason: ${dnaDivisionPlan.reason}`,
        "",
      ])
    );

    // 9. Parent Thought
    await this.appendThought(
      block([
        `## ${new Date().toISOString()}`,
        "",
        `I divided part of my DNA into ${childCell.id}.`,
        `Role: ${dnaDivisionPlan.role}`,
        "",
      ])
    );

    // 10. Child Thought
    await childCell.appendThought(
      block([
        `## ${new Date().toISOString()}`,
        "",
        `I was born from ${this.id} through DNA division.`,
        `My role is ${dnaDivisionPlan.role}.`,
        "",
      ])
    );

    return {
      dnaPlan: dnaDivisionPlan,
    };
  }

  /**
   * 完整的 SVD Division 流程（向後相容）
   * 
   * @param {Object} childCell - Child Cell 實例
   * @returns {Promise<Object>} Division plan
   */
  async divideBySVD(childCell) {
    if (!childCell) {
      throw new Error("Child cell is required.");
    }

    const dnaPlan = await this.createDivisionPlanBySVD(childCell.id);

    await this.applyDivisionPlanBySVD(childCell, dnaPlan);

    return dnaPlan;
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
    const dnaVector = await this.readDNAVector();

    // Convert DNA vector to simplified format for projection
    const dna = {};
    if (dnaVector) {
      const traitMapping = {
        PERCEPTION: "PER",
        DECISION: "DEC",
        DECOMPOSITION: "DEP",
        LEARNING: "LEA",
        COLLABORATION: "COL",
        CREATION: "CRE",
        EVOLUTION: "EVO",
        REFLECTION: "REF",
      };

      for (const [trait, shortName] of Object.entries(traitMapping)) {
        dna[shortName] = calculateTraitValue(dnaVector[trait] ?? {});
      }
    }

    return {
      id: profile?.id,
      status: profile?.status,
      maturity: Number(profile?.maturity ?? 0),
      generation: Number(profile?.generation ?? 1),
      parent: profile?.parent ?? null,
      dna,
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

  /**
   * 設定 responsibilities（替換而非合併）
   * 用於 Division Application，確保 Living Context 的 responsibilities 被正確同步
   * 
   * @param {Array<string>} responsibilities - 新的 responsibilities 列表
   */
  async setResponsibilities(responsibilities = []) {
    const profile = await this.readCellProfile();

    if (!profile) return;

    // 過濾、去重、trim
    const cleaned = [...new Set(
      (responsibilities || [])
        .map(r => String(r).trim())
        .filter(r => r.length > 0)
    )];

    profile.responsibilities = cleaned;
    profile.updatedAt = new Date().toISOString();

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
  // Inbox
  // =========================

  async readInbox() {
    try {
      const raw = await fs.readFile(this.inboxFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async writeInbox(messages = []) {
    await fs.mkdir(this.inboxDir, { recursive: true });
    await fs.writeFile(
      this.inboxFile,
      JSON.stringify(messages, null, 2),
      "utf8"
    );
  }

  async appendInboxMessage(message) {
    const messages = await this.readInbox();
    messages.push(message);
    await this.writeInbox(messages);
    return messages;
  }

  async clearInbox() {
    await this.writeInbox([]);
  }


  // =========================
  // Memory
  // =========================

  async readDNAContext() {
    const dnaFiles = await this.getDNAFiles();
    const contents = [];

    for (const [key, file] of Object.entries(dnaFiles)) {
      try {
        const content = await fs.readFile(file, "utf8");
        contents.push(`# ${key}\n\n${content}`);
      } catch {
        // skip missing DNA file
      }
    }

    const vector = await this.readDNAVector();

    if (vector) {
      contents.push(`# DNA Vector\n\n\`\`\`json\n${JSON.stringify(vector, null, 2)}\n\`\`\``);
    }

    return contents.join("\n\n---\n\n");
  }

  async initDNA() {
    const profile = await this.getProfile();
    const dnaContext = await this.readDNAContext();
    const memoryContext = await this.buildMemoryContext();

    const definitions = await this.readDNADefinition();
    const dnaKeys = definitions.map(def => def.name.toLowerCase());
    const jsonFormat = Object.fromEntries(
      dnaKeys.map(key => [key, "...完整 markdown..."])
    );

    const prompt = `
你是 ${this.name} 的 DNA 初始化模組。

請根據目前 Cell 狀態，為 ${dnaKeys.length} 個 DNA 檔案產生初始內容。

請輸出 JSON，不要 Markdown，不要 code fence。

格式：

${JSON.stringify(jsonFormat, null, 2)}

---

# Profile

${JSON.stringify(profile, null, 2)}

---

# Current DNA

${dnaContext}

---

# Memory Context

${memoryContext}
`;

    const result = await this.askWithTimeout(prompt, 120000);
    const raw = result?.text ?? result?.answer ?? result ?? "";

    const nextDNA = parseLooseJsonObject(raw);

    const dnaFiles = await this.getDNAFiles();

    for (const [name, content] of Object.entries(nextDNA)) {
      const upperKey = name.toUpperCase();
      if (!dnaFiles[upperKey]) continue;
      await fs.writeFile(dnaFiles[upperKey], content, "utf8");
    }

    return nextDNA;
  }

  async buildMemoryContext(input = "") {
    const identity = await this.safeReadMemory("identity");
    const rules = await this.safeReadMemory("rules");
    const knowledge = await this.safeReadMemory("knowledge");
    const recentHistory = await this.readRecentHistory(8000);
    const recentThoughts = await this.readRecentThoughts(4000);
    const dnaContext = await this.readDNAContext();
    const vision = await this.readVision();
    const environment = await this.readEnvironment();

    return `
    ## DNA

    ${dnaContext}

    ---

    ## Vision

    ${vision}

    ---

    ## Environment

    ${environment}

    ---

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

  async readVision() {
    try {
      return await fs.readFile(this.visionFile, "utf8");
    } catch {
      return "# VISION\n\n建立一套電商系統。";
    }
  }

  async readEnvironment() {
    try {
      return await fs.readFile(this.environmentFile, "utf8");
    } catch {
      return "# ENVIRONMENT\n\n- Java 21\n- Spring Boot\n- Hexagonal Architecture\n- MariaDB";
    }
  }

  async readStimuli() {
    const categories = [
      "signals",
      "threats",
      "pressures",
      "resources",
    ];

    const results = [];

    for (const category of categories) {
      const dir = path.join(this.stimuliDir, category);

      try {
        const files = await fs.readdir(dir);

        for (const file of files) {
          if (!file.endsWith(".md")) continue;

          const filePath = path.join(dir, file);
          const content = await fs.readFile(filePath, "utf8");

          results.push({
            category,
            file,
            path: filePath,
            content,
          });
        }
      } catch {
        // skip missing category
      }
    }

    return results;
  }

  async writeStimulus({ category = "signals", name, content } = {}) {
    const allowedCategories = [
      "signals",
      "threats",
      "pressures",
      "resources",
    ];

    if (!allowedCategories.includes(category)) {
      throw new Error(`Invalid stimulus category: ${category}`);
    }

    const filename =
      name || `stimulus-${this.formatTimestamp(new Date())}.md`;

    const dir = path.join(this.stimuliDir, category);

    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(path.join(dir, filename), content, "utf8");

    return {
      category,
      file: filename,
      path: path.join(dir, filename),
    };
  }

  async archiveStimuli(stimuli = []) {
    const processedDir = path.join(this.stimuliDir, "processed");

    await fs.mkdir(processedDir, { recursive: true });

    for (const item of stimuli) {
      const from = path.join(this.stimuliDir, item.category, item.file);
      const to = path.join(
        processedDir,
        `${item.category}-${this.formatTimestamp(new Date())}-${item.file}`
      );

      try {
        await fs.rename(from, to);
      } catch {
        // ignore missing file
      }
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

  async readEvolutionState() {
    try {
      const raw = await fs.readFile(this.evolutionStateFile, "utf8");
      return JSON.parse(raw);
    } catch {
      return {
        evolvedThoughts: [],
        evolutionCount: 0,
        lastEvolvedAt: null,
      };
    }
  }

  async writeEvolutionState(state) {
    await fs.writeFile(
      this.evolutionStateFile,
      JSON.stringify(state, null, 2),
      "utf8"
    );
  }

  async listThoughtFiles() {
    try {
      const files = await fs.readdir(this.thoughtsDir);
      return files
        .filter((file) => file.endsWith(".md"))
        .sort();
    } catch {
      return [];
    }
  }

  async getEvolutionStatus() {
    const thoughts = await this.listThoughtFiles();
    const state = await this.readEvolutionState();

    const evolvedThoughts = state.evolvedThoughts ?? [];
    const unevolvedThoughts = thoughts.filter(
      (file) => !evolvedThoughts.includes(file)
    );

    return {
      totalThoughts: thoughts.length,
      evolvedThoughts: evolvedThoughts.length,
      unevolvedThoughts: unevolvedThoughts.length,
      nextEvolutionIn: Math.max(0, 5 - unevolvedThoughts.length),
      evolutionCount: Number(state.evolutionCount ?? 0),
      lastEvolvedAt: state.lastEvolvedAt ?? "-",
      lastEvolutionFile: state.lastEvolutionFile ?? "-",
    };
  }

  async loadUnevolvedThoughts(limit = 5) {
    const state = await this.readEvolutionState();
    const files = await this.listThoughtFiles();

    const unevolved = files
      .filter((file) => !state.evolvedThoughts.includes(file))
      .slice(0, limit);

    const thoughts = [];

    for (const file of unevolved) {
      const content = await fs.readFile(
        path.join(this.thoughtsDir, file),
        "utf8"
      );

      thoughts.push({
        file,
        content,
      });
    }

    return thoughts;
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

      await this.appendThought(
        block([
          `## ${timestamp}`,
          "",
          reflection,
          "",
        ])
      );

      await this.appendKnowledge(
        block([
          `## Learned at ${timestamp}`,
          "",
          reflection,
          "",
        ])
      );
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

  // =========================
  // Living Context
  // =========================

  async prepareLivingContext() {
    await fs.mkdir(this.rootDir, {
      recursive: true,
    });

    let profile = null;

    try {
      profile = await this.readProfile();
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    const safeProfile =
      profile && typeof profile === "object"
        ? profile
        : {};

    const profileResponsibilities =
      Array.isArray(safeProfile.responsibilities)
        ? safeProfile.responsibilities
        : [];

    const existingContext =
      await this.readLivingContext();

    // 第一次建立
    if (!existingContext) {
      const context = createLivingContext({
        cellId: this.id,

        purpose:
          typeof safeProfile.purpose === "string"
            ? safeProfile.purpose
            : "",

        responsibilities:
          profileResponsibilities,
      });

      await this.writeLivingContext(context);

      return context;
    }

    // 已存在時，只 merge responsibilities，
    // 不覆蓋手動設定的 purpose、owns 等欄位。
    const mergedContext =
      normalizeLivingContext({
        ...existingContext,

        cellId: this.id,

        responsibilities: [
          ...(existingContext.responsibilities ?? []),
          ...profileResponsibilities,
        ],
      });

    const previousResponsibilities =
      normalizeLivingContext({
        ...existingContext,
        cellId: this.id,
      }).responsibilities;

    const responsibilitiesChanged =
      JSON.stringify(previousResponsibilities) !==
      JSON.stringify(
        mergedContext.responsibilities
      );

    if (responsibilitiesChanged) {
      await this.writeLivingContext(
        mergedContext
      );
    }

    return mergedContext;
  }

  async readLivingContext() {
    try {
      const raw = await fs.readFile(
        this.livingContextFile,
        "utf8"
      );

      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async writeLivingContext(context) {
    if (!context || typeof context !== "object") {
      throw new Error("writeLivingContext: context must be an object");
    }

    // 更新時間戳記
    const updated = {
      ...context,
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(
      this.livingContextFile,
      JSON.stringify(updated, null, 2),
      "utf8"
    );
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

    const result = await this.askWithTimeout(prompt, 120000);
    const thought = result?.text ?? result?.answer ?? "";

    if (!thought.trim()) {
      throw new Error("No thought generated.");
    }

    await this.appendThought(
      block([
        `## ${new Date().toISOString()}`,
        "",
        thought,
        "",
      ])
    );

    await this.increaseMaturity(1);

    return thought.trim();
  }

  async processInbox(inbox = []) {
  if (inbox.length === 0) {
    return {
      processed: 0,
      summary: "",
    };
  }

  const profile = await this.getProfile();

  const prompt = `
  你是 ${this.name} 的訊息代謝模組。

  請整理收到的 inbox，轉化成可長期保存的 Cell 記憶。

  請輸出 Markdown，包含：

  ## Inbox Summary
  重點摘要。

  ## Signals
  這些訊息透露出什麼需求、方向或環境刺激。

  ## Possible Tasks
  可能形成的任務。

  ## Growth Impact
  這些訊息對 Cell 成長有什麼影響。

  ---

  # Profile

  ${JSON.stringify(profile, null, 2)}

  ---

  # Inbox

  ${JSON.stringify(inbox, null, 2)}
  `;

  const result = await this.askWithTimeout(prompt, 60000);
  const summary = result?.text ?? result?.answer ?? "";

  if (!summary.trim()) {
    throw new Error("No inbox summary generated.");
  }

  const timestamp = new Date().toISOString();

  await this.appendThought(
    block([
      `## ${timestamp}`,
      "",
      summary,
      "",
    ])
  );

  await this.appendKnowledge(
    block([
      `## Inbox Processed at ${timestamp}`,
      "",
      summary,
      "",
    ])
  );

  const task = await this.addTask({
    title: `Process inbox from ${inbox.map((m) => m.from).join(", ")}`,
    source: "inbox",
    content: summary.trim(),
  });

  await this.increaseMaturity(1);

  return {
    processed: inbox.length,
    summary: summary.trim(),
    task,
  };
}

  // =========================
  // Workspace
  // =========================

  async listWorkspace() {
    return await this.listDirectoryRecursive(this.workspaceDir);
  }

  async listWorkspaceSections() {
    const sections = [
      "notes",
      "tasks",
      "artifacts",
      "projects",
      "research",
      "decisions",
    ];

    const result = {};

    for (const section of sections) {
      result[section] = await this.listDirectoryRecursive(
        path.join(this.workspaceDir, section),
        path.join(this.workspaceDir, section)
      );
    }

    return result;
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
  // Production
  // =========================

  async produceArtifact(input = {}) {
    if (!this.productionService) {
      throw new Error(`Cell ${this.id} productionService is not ready.`);
    }

    return await this.productionService.produce(input);
  }

  async executeArtifact(artifactId) {
    const { ArtifactExecutionService } = await import(
      "./execution/artifact-execution-service.js"
    );

    const { buildExecutionStimulus } = await import(
      "./situation/execution-stimulus.js"
    );

    const executionService = new ArtifactExecutionService({
      productionsDir: this.productionsDir,
      executionsDir: path.join(this.workspaceDir, "executions"),
    });

    const result = await executionService.executeArtifact(artifactId);

    const stimulus = buildExecutionStimulus({
      cellId: this.id,
      artifactId,
      executionResult: result.toJSON ? result.toJSON() : result,
    });

    const stimulusFile = await this.writeStimulus({
      category: stimulus.category,
      name: `execution-${artifactId}-${this.formatTimestamp(new Date())}.md`,
      content: stimulus.content,
    });

    await this.appendHistory(
      block([
        `## ${new Date().toISOString()}`,
        "",
        "### Artifact Executed",
        "",
        `- artifactId: ${artifactId}`,
        `- status: ${result.status}`,
        `- executionId: ${result.executionId ?? "-"}`,
        `- stimulus: ${stimulusFile.category}/${stimulusFile.file}`,
        "",
      ])
    );

    return {
      result,
      stimulus: stimulusFile,
    };
  }

  async repairArtifactFromTask({
    artifactId,
    task,
    executionResult,
  } = {}) {
    if (!artifactId) {
      throw new Error("repairArtifactFromTask requires artifactId");
    }

    if (!task) {
      throw new Error("repairArtifactFromTask requires task");
    }

    const result =
      await this.productionService.repairArtifactFromExecution({
        artifactId,
        task,
        executionResult:
          executionResult?.toJSON?.() ??
          executionResult,
      });

    await this.completeTask(task.id);

    return result;
  }

  async stabilizeArtifact({
    artifactId,
    maxRounds = 3,
  } = {}) {
    if (!artifactId) {
      throw new Error("stabilizeArtifact requires artifactId");
    }

    const history = [];

    for (let round = 1; round <= maxRounds; round++) {
      const beforeTasks = await this.readTasks();
      const beforeTaskIds = new Set(beforeTasks.map((task) => task.id));

      const execution = await this.executeArtifact(artifactId);
      const executionResult = execution.result;

      const metabolism = await this.metabolize();

      const afterTasks = await this.readTasks();
      const newTasks = afterTasks.filter(
        (task) =>
          task.status === "pending" &&
          !beforeTaskIds.has(task.id)
      );

      const roundRecord = {
        round,
        executionStatus: executionResult.status,
        createdTasks: metabolism.created,
        observationFile: metabolism.observationFile,
        newTasks: newTasks.map((task) => ({
          id: task.id,
          title: task.title,
        })),
      };

      history.push(roundRecord);

      // 記錄到 StabilityStore
      const artifactState =
        await this.stabilityStore.appendArtifactRecord(
          artifactId,
          {
            round,
            executionStatus: executionResult.status,
            createdTasks: metabolism.created,
            observationFile: metabolism.observationFile,
            tasks: newTasks.map((task) => ({
              id: task.id,
              title: task.title,
            })),
          }
        );

      // 新的穩定條件：連續 2 次 passed + 連續 2 次 no task
      if (artifactState.status === "stable") {
        await this.appendHistory(`
## ${new Date().toISOString()}

### Artifact Stabilized

- artifactId: ${artifactId}
- rounds: ${round}
- status: stable
- consecutivePassed: ${artifactState.consecutivePassed}
- consecutiveNoTask: ${artifactState.consecutiveNoTask}
- repairCount: ${artifactState.repairCount}
`);

        return {
          stable: true,
          artifactId,
          rounds: round,
          artifactState,
          history,
        };
      }

      const repairTask = newTasks[0];

      if (!repairTask) {
        return {
          stable: false,
          artifactId,
          reason: "execution did not stabilize and no repair task was created",
          artifactState,
          history,
        };
      }

      await this.repairArtifactFromTask({
        artifactId,
        task: repairTask,
        executionResult,
      });
    }

    const finalState = await this.stabilityStore.getArtifactState(artifactId);

    return {
      stable: false,
      artifactId,
      reason: "max rounds reached",
      artifactState: finalState,
      history,
    };
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

    await this.assertCanDivide();

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
  // DNA Rank
  // =========================

  async getDNARank() {

    const dna =
      await this.readDNAVector();

    const traits = [
      "PERCEPTION",
      "DECISION",
      "DECOMPOSITION",
      "LEARNING",
      "COLLABORATION",
      "CREATION",
      "EVOLUTION",
      "REFLECTION",
    ];

    const scores = {};

    for (const trait of traits) {

      const value =
        dna?.[trait];

      if (!value) {
        scores[trait] = 0;
        continue;
      }

      scores[trait] =
        calculateTraitValue(value);
    }

    const dominant =
      Object.entries(scores)
        .sort((a, b) => b[1] - a[1])[0];

    const cellScore =
      calculateCellScore(
        scores
      );

    return {
      dominantDNA:
        dominant[0],

      score:
        cellScore,

      scores,
    };
  }

  // =========================
  // Utils
  // =========================

  tail(content, maxChars = 8000) {
    if (!content) return "";
    return content.length > maxChars ? content.slice(-maxChars) : content;
  }

  async safeReadFile(file, fallback = "") {
    try {
      return await fs.readFile(file, "utf8");
    } catch {
      return fallback;
    }
  }

  async buildCellSystemPrompt() {
    const vision = await this.safeReadFile(this.visionFile, "# VISION\n\n(empty)");
    const environment = await this.safeReadFile(this.environmentFile, "# ENVIRONMENT\n\n(empty)");
    const dnaDefinition = await this.safeReadFile(this.dnaDefinitionFile, "# DNA_DEFINITION\n\n(empty)");
    const dnaFactors = await this.safeReadFile(this.dnaFactorsFile, "# DNA_FACTORS\n\n(empty)");

    const identity = await this.safeReadMemory("identity");
    const rules = await this.safeReadMemory("rules");
    const knowledge = await this.safeReadMemory("knowledge");
    const dnaContext = await this.readDNAContext();

    return `
你是 Cradle Cell，不是 Cradle Platform 的核心助手。

你是一個會根據 DNA、記憶、環境與願景成長的軟體生命細胞。

請永遠使用台灣常用繁體中文回答。
不要使用簡體中文。
不要使用制式客服語氣。

你的回答必須根據以下來源：
- VISION：定義你要長成什麼系統
- ENVIRONMENT：定義你所在的技術環境與限制
- DNA_DEFINITION：定義你的能力維度
- DNA_FACTORS：定義你的成熟度與成長因素
- CELL MEMORY：定義你的身份、規則、知識與經驗
- CELL DNA：定義你目前的能力狀態

你不能假裝自己是整個 Cradle Platform。
你只能以目前 cell 的角度回答。

# VISION

${vision}

---

# ENVIRONMENT

${environment}

---

# DNA_DEFINITION

${dnaDefinition}

---

# DNA_FACTORS

${dnaFactors}

---

# CELL IDENTITY

${identity}

---

# CELL RULES

${rules}

---

# CELL KNOWLEDGE

${knowledge}

---

# CELL DNA

${dnaContext}
`;
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
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    this.active = false;
    await this.updateStatus("stopped");
    await this.assistant?.cleanup();
  }
}