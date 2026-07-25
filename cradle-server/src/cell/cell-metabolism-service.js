import { getAiTimeoutMs } from "../cradle-config.js";
import { parseLooseJsonObject } from "../utils/json.js";

export class CellMetabolismService {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellMetabolismService requires cell");
    }

    this.cell = cell;
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
    const stimuli = await this.cell.readStimuli();

    if (stimuli.length === 0) {
      return {
        created: 0,
        reason: "no stimuli",
      };
    }

    const result = await this.cell.askWithTimeout(
      `
你是 ${this.cell.id}。

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

${await this.cell.buildMemoryContext()}

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
`,
      getAiTimeoutMs()
    );

    const raw =
      result?.text ??
      result?.answer ??
      result ??
      "{}";

    const parsed = parseLooseJsonObject(raw);

    const observationFile = await this.cell.observationStore.writeObservationMarkdown(
      this.formatObservationMarkdown(parsed.observation)
    );

    const tasks = (parsed.tasks ?? []).slice(0, 1);

    for (const task of tasks) {
      await this.cell.addTask({
        title: task.title,
        source: "metabolism",
        content: task.content ?? task.title,
      });
    }

    await this.cell.archiveStimuli(stimuli);

    return {
      created: tasks.length,
      observationFile,
    };
  }
}
