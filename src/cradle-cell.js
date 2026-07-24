// cradle-cell.js
import fs from "fs/promises";
import path from "path";
import { createCradleAssistant } from "./cradle-ai.js";
import { createLLMProvider } from "./providers/llm-provider-factory.js";
import { createCellPaths } from "./cell/cell-paths.js";
import { createCellRuntimeServices } from "./cell/cell-runtime-services.js";
import { CellPromptContextService } from "./cell/cell-prompt-context-service.js";
import { CellLifecycleFacade } from "./cell/cell-lifecycle-facade.js";
import { prepareCellDirectories } from "./cell/cell-directory-preparer.js";
import { mergeCellProfileForStart } from "./cell/cell-profile.js";
import { block } from "./utils/text.js";
import { parseLooseJsonObject } from "./utils/json.js";
import { writeJsonFile } from "./utils/json-file.js";
import {
  getAiTimeoutMs,
  getTimeoutMs,
} from "./cradle-config.js";
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
  calculateDNAMatrixCentroid,
} from "./dna/dna-centroid.js";
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
    projectRoot = process.cwd(),
    cellsDir = "cells",
  } = {}) {
    this.id = id;
    this.name = name;
    this.model = model;
    this.provider = provider;

    this.paths = createCellPaths({
      cellId: this.id,
      projectRoot,
      cellsDir,
    });
    Object.assign(this, this.paths);

    Object.assign(
      this,
      createCellRuntimeServices({
        cell: this,
        paths: this.paths,
      })
    );
    this.promptContextService = new CellPromptContextService({
      cell: this,
    });
    this.lifecycleFacade = new CellLifecycleFacade({
      cell: this,
    });

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

    const provider = await createLLMProvider({
      provider: this.provider,
      model: this.model,
      cwd: process.cwd(),
    });

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
    console.log(`⏱️ ${this.id} tick`);

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
    `, getAiTimeoutMs());

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
`, getAiTimeoutMs());

    const raw =
      result?.text ??
      result?.answer ??
      result ??
      "{}";

    const parsed = parseLooseJsonObject(raw);

    const observationFile = await this.observationStore.writeObservationMarkdown(
      this.formatObservationMarkdown(parsed.observation)
    );

    const tasks = (parsed.tasks ?? []).slice(0, 1);

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

      const result = await this.askWithTimeout(cellInput, getAiTimeoutMs());
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

  async askWithTimeout(
    input,
    timeoutMs = getAiTimeoutMs()
  ) {
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
    await prepareCellDirectories(this.paths);

    const now = new Date().toISOString();
    const existingProfile = await this.readCellProfile();
    const nextProfile = mergeCellProfileForStart({
      existingProfile,
      id: this.id,
      name: this.name,
      model: this.model,
      paths: this.paths,
      now,
    });

    await this.writeCellProfile(nextProfile);
  }


  async readTasks() {
    return await this.taskStore.readTasks();
  }

  async writeTasks(tasks = []) {
    await this.taskStore.writeTasks(tasks);
  }

  async addTask({ title, source = "manual", content = "" }) {
    return await this.taskStore.addTask({ title, source, content });
  }

  async completeTask(taskId) {
    await this.taskStore.completeTask(taskId);
  }

  async nextPendingTask() {
    return await this.taskStore.nextPendingTask();
  }

  /**
   * Read lifecycle events history
   * @returns {Promise<Array>} Array of lifecycle events
   */
  async readLifecycleEvents() {
    return await this.lifecycleEventStore.readLifecycleEvents();
  }

  /**
   * Append a lifecycle event to history
   * @param {Object} event - Event to append
   * @returns {Promise<void>}
   */
  async appendLifecycleEvent(event = {}) {
    await this.lifecycleEventStore.appendLifecycleEvent(event);
  }

  async readDNADefinition() {
    return await this.configStore.readDNADefinition();
  }

  async getDNAFiles() {
    return await this.configStore.getDNAFiles();
  }

  async readDNAFactors() {
    return await this.configStore.readDNAFactors();
  }

  async prepareMemoryFiles() {
    await this.memoryStore.prepareMemoryFiles();
  }

  async ensureRootFiles() {
    await this.configStore.ensureRootFiles();
  }

  async prepareDNAFiles() {
    await this.configStore.prepareDNAFiles();
  }

  createDNASeed(name) {
    return this.configStore.createDNASeed(name);
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
    return await this.dnaStore.readDNAVector();
  }

  async writeDNAVector(vector) {
    await this.dnaStore.writeDNAVector(vector);
  }

  async appendDNAHistory(reason = "unknown") {
    await this.dnaStore.appendDNAHistory(reason);
  }

  /**
   * Append DNA history only if vector has changed
   * This prevents false maturity from appending identical vectors
   * which would artificially decrease temporal variance
   * @param {string} reason - Reason for the change
   * @returns {Promise<boolean>} True if appended, false if unchanged
   */
  async appendDNAHistoryIfChanged(reason = "unknown") {
    return await this.dnaStore.appendDNAHistoryIfChanged(reason);
  }

  async readDNAHistory() {
    return await this.dnaStore.readDNAHistory();
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
      `, getAiTimeoutMs());

            const raw = result?.text ?? result?.answer ?? "{}";
            const evolution = this.parseEvolutionJson(raw);

            await this.applyDNADrift(evolution.dnaDrift ?? []);

            const filename = await this.evolutionStore.writeEvolutionJournal({
              evolution,
              thoughts,
            });

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

  async readCellProfile() {
    return await this.profileStore.readCellProfile();
  }

  async readProfile() {
    return await this.profileStore.readProfile();
  }

  async writeCellProfile(profile) {
    await this.profileStore.writeCellProfile(profile);
  }

  async updateStatus(status) {
    await this.profileStore.updateStatus(status);
  }

  /**
   * Legacy maturity counter (deprecated)
   * DNA maturity is now calculated from dna-history.json
   * Keep this for backward compatibility only
   */
  async increaseMaturity(amount = 1) {
    await this.profileStore.increaseMaturity(amount);
  }

  async getProfile() {
    return await this.profileStore.getProfile();
  }

  async getStatus() {
    return await this.profileStore.getStatus();
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
   * Returns action recommendation: stay / repair / divide / fuse
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
    return await this.lifecycleFacade.getLifecycleDecision({
      hasComplementaryCell,
      recentFailureRate,
    });
  }

  async observeCradle(snapshot) {
    return await this.lifecycleFacade.observeCradle(snapshot);
  }

  async proposeLifecycle({ observation, snapshot } = {}) {
    return await this.lifecycleFacade.proposeLifecycle({
      observation,
      snapshot,
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

    // TEST ONLY: temporarily bypass maturity check
    // await this.assertCanDivide();

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

    // 5. 設定 parent identity
    await childCell.setParent(this.id);

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
    await this.profileStore.setGeneration(generation);
  }

  async setParent(parentId) {
    await this.profileStore.setParent(parentId);
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
    await this.profileStore.addResponsibility(name);
  }

  async removeResponsibility(name) {
    await this.profileStore.removeResponsibility(name);
  }

  /**
   * 設定 responsibilities（替換而非合併）
   * 用於 Division Application，確保 Living Context 的 responsibilities 被正確同步
   * 
   * @param {Array<string>} responsibilities - 新的 responsibilities 列表
   */
  async setResponsibilities(responsibilities = []) {
    await this.profileStore.setResponsibilities(responsibilities);
  }

  async listResponsibilities() {
    return await this.profileStore.listResponsibilities();
  }

  async addRelationship(
    type,
    target
  ) {
    await this.profileStore.addRelationship(type, target);
  }

  async listRelationships() {
    return await this.profileStore.listRelationships();
  }


  // =========================
  // Inbox
  // =========================

  async readInbox() {
    return await this.inboxStore.readInbox();
  }

  async writeInbox(messages = []) {
    await this.inboxStore.writeInbox(messages);
  }

  async appendInboxMessage(message) {
    return await this.inboxStore.appendInboxMessage(message);
  }

  async clearInbox() {
    await this.inboxStore.clearInbox();
  }


  // =========================
  // Memory
  // =========================

  async readDNAContext() {
    return await this.promptContextService.readDNAContext();
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

    const result = await this.askWithTimeout(prompt, getAiTimeoutMs());
    const raw = result?.text ?? result?.answer ?? result ?? "";

    const nextDNA = parseLooseJsonObject(raw);

    const dnaFiles = await this.getDNAFiles();
    await this.dnaStore.writeDNAFiles(dnaFiles, nextDNA);

    return nextDNA;
  }

  async buildMemoryContext(input = "") {
    return await this.promptContextService.buildMemoryContext(input);
  }

  async readMemoryContext() {
    return await this.promptContextService.readMemoryContext();
  }

  async safeReadMemory(name) {
    return await this.memoryStore.safeReadMemory(name);
  }

  async readVision() {
    return await this.configStore.readVision();
  }

  async readEnvironment() {
    return await this.configStore.readEnvironment();
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
    return await this.stimulusStore.writeStimulus({
      category,
      name,
      content,
    });
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
    return await this.evolutionStore.readRecentThoughts(maxChars);
  }

  async readEvolutionState() {
    return await this.evolutionStore.readEvolutionState();
  }

  async writeEvolutionState(state) {
    await this.evolutionStore.writeEvolutionState(state);
  }

  async listThoughtFiles() {
    return await this.evolutionStore.listThoughtFiles();
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
    return await this.evolutionStore.loadUnevolvedThoughts(limit);
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

      const result = await this.askWithTimeout(reflectionPrompt, getTimeoutMs("reflectionSeconds"));
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
    return await this.memoryStore.readMemory(name);
  }

  async writeMemory(name, content) {
    await this.memoryStore.writeMemory(name, content);
  }

  async appendMemory(name, content) {
    await this.memoryStore.appendMemory(name, content);
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
    return await this.livingContextStore.readLivingContext();
  }

  async writeLivingContext(context) {
    await this.livingContextStore.writeLivingContext(context);
  }

  async appendKnowledge(content) {
    await this.memoryStore.appendKnowledge(content);
  }

  async appendHistory(content) {
    await this.memoryStore.appendHistory(content);
  }

  async appendThought(content) {
    await this.memoryStore.appendThought(content);
  }

  resolveMemoryFile(name) {
    return this.memoryStore.resolveMemoryFile(name);
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

    const result = await this.askWithTimeout(prompt, getAiTimeoutMs());
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

  const result = await this.askWithTimeout(prompt, getAiTimeoutMs());
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
    return await this.workspaceStore.listWorkspace();
  }

  async listWorkspaceSections() {
    return await this.workspaceStore.listWorkspaceSections();
  }

  async writeWorkspaceFile(relativePath, content) {
    await this.workspaceStore.writeWorkspaceFile(relativePath, content);
  }

  async readWorkspaceFile(relativePath) {
    return await this.workspaceStore.readWorkspaceFile(relativePath);
  }

  async appendWorkspaceFile(relativePath, content) {
    await this.workspaceStore.appendWorkspaceFile(relativePath, content);
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

    const { ThreatStore } = await import(
      "./heartbeat/threat-store.js"
    );

    const { buildExecutionStimulus } = await import(
      "./situation/execution-stimulus.js"
    );

    const executionService = new ArtifactExecutionService({
      cellId: this.id,
      productionsDir: this.productionsDir,
      executionsDir: path.join(this.workspaceDir, "executions"),
      threatStore: new ThreatStore(),
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

      const passed = executionResult.status === "passed";

      const metabolism = await this.metabolize();

      const afterTasks = await this.readTasks();

      const generatedTasks = afterTasks.filter(
        (task) =>
          task.status === "pending" &&
          !beforeTaskIds.has(task.id)
      );

      // 成功輪次產生的建議，不是修復任務
      const repairTasks = passed
        ? []
        : generatedTasks.slice(0, 1);

      // 成功輪次多產生的 task 直接結束，避免殘留
      if (passed) {
        for (const task of generatedTasks) {
          await this.completeTask(task.id);
        }
      }

      const roundRecord = {
        round,
        executionStatus: executionResult.status,
        createdTasks: repairTasks.length,
        observationFile: metabolism.observationFile,
        newTasks: repairTasks.map((task) => ({
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
            createdTasks: repairTasks.length,
            observationFile: metabolism.observationFile,
            tasks: repairTasks.map((task) => ({
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

      const repairTask = repairTasks[0];

      if (!repairTask) {
        if (passed) {
          // 本輪成功且沒有修復任務，繼續下一輪累積穩定條件
          continue;
        }

        return {
          stable: false,
          artifactId,
          reason: "execution failed and no repair task was created",
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
    return await this.snapshotStore.createSnapshot(name);
  }

  async listSnapshots() {
    return await this.snapshotStore.listSnapshots();
  }

  async restoreSnapshot(snapshotName) {
    await this.snapshotStore.restoreSnapshot(snapshotName);
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

    await writeJsonFile(path.join(childRootDir, "cell.json"), childProfile);

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
    return await this.promptContextService.buildCellSystemPrompt();
  }

  async listDirectoryRecursive(dir, baseDir = dir) {
    return await this.workspaceStore.listDirectoryRecursive(dir, baseDir);
  }

  async copyDirectory(source, target) {
    await this.snapshotStore.copyDirectory(source, target);
  }

  resolveInside(baseDir, relativePath) {
    return this.workspaceStore.resolveInside(baseDir, relativePath);
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
