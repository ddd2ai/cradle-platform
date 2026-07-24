import fs from "fs/promises";
import path from "path";

import { block } from "../utils/text.js";
import { parseLooseJsonObject } from "../utils/json.js";
import {
  getAiTimeoutMs,
  getTimeoutMs,
} from "../cradle-config.js";

export class CellEvolutionFacade {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellEvolutionFacade requires cell");
    }

    this.cell = cell;
  }

  async applyDNADrift(dnaDrift = []) {
    const vector = await this.cell.readDNAVector();

    if (!vector) return;

    for (const drift of dnaDrift) {
      const trait = String(drift.trait ?? "").toUpperCase();
      const factor = drift.factor;
      const delta = Number(drift.delta ?? 0);

      if (!trait || !factor) continue;

      vector[trait] ??= {};
      vector[trait][factor] ??= 0.5;

      vector[trait][factor] =
        this.cell.clampDNAValue(Number(vector[trait][factor]) + delta);
    }

    await this.cell.writeDNAVector(vector);
    await this.cell.appendDNAHistory("evolution");
  }

  async calculateDNAVelocity(windowSize = 5) {
    let history = [];

    try {
      const raw = await fs.readFile(this.cell.dnaHistoryFile, "utf8");
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
        this.cell.evolutionsDir
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
          this.cell.evolutionsDir,
          latest
        ),
        "utf8"
      );
    } catch {
      return null;
    }
  }

  async evolve({ force = false } = {}) {
    if (this.cell.isEvolving) {
      return {
        evolved: false,
        reason: "already evolving",
        thoughtCount: 0,
      };
    }

    this.cell.isEvolving = true;

    try {
      const thoughts = await this.cell.loadUnevolvedThoughts(5);

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

      const dnaVector = await this.cell.readDNAVector();

      const thoughtContext = thoughts
        .map((thought) => `
      ## ${thought.file}

      ${this.cell.tail(thought.content, 1200)}
      `)
              .join("\n\n");

            const result = await this.cell.askWithTimeout(`
      你是 ${this.cell.id} 的 Evolution 模組。

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

            const filename = await this.cell.evolutionStore.writeEvolutionJournal({
              evolution,
              thoughts,
            });

      const state = await this.cell.readEvolutionState();

      state.evolvedThoughts = [
        ...new Set([
          ...(state.evolvedThoughts ?? []),
          ...thoughts.map((thought) => thought.file),
        ]),
      ];

      state.evolutionCount = Number(state.evolutionCount ?? 0) + 1;
      state.lastEvolvedAt = new Date().toISOString();
      state.lastEvolutionFile = filename;

      await this.cell.writeEvolutionState(state);

      return {
        evolved: true,
        file: filename,
        thoughtCount: thoughts.length,
        dnaDrift: evolution.dnaDrift ?? [],
        affinities: evolution.affinities ?? [],
      };
    } finally {
      this.cell.isEvolving = false;
    }
  }

  async getEvolutionStatus() {
    const thoughts = await this.cell.listThoughtFiles();
    const state = await this.cell.readEvolutionState();

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

  async reflect({ input, output }) {
    try {
      const reflectionPrompt = `
      你是 ${this.cell.name} 的自我反思模組。

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

      const result = await this.cell.askWithTimeout(reflectionPrompt, getTimeoutMs("reflectionSeconds"));
      const reflection = result?.text ?? result?.answer ?? "";

      if (!reflection.trim()) return;

      const timestamp = new Date().toISOString();

      await this.cell.appendThought(
        block([
          `## ${timestamp}`,
          "",
          reflection,
          "",
        ])
      );

      await this.cell.appendKnowledge(
        block([
          `## Learned at ${timestamp}`,
          "",
          reflection,
          "",
        ])
      );
    } catch {
      // reflection failure should not interrupt the main task
    }
  }
}
