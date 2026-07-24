import { block } from "../utils/text.js";
import {
  getAiTimeoutMs,
} from "../cradle-config.js";

export class CellThinkingService {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellThinkingService requires cell");
    }

    this.cell = cell;
  }

  async think() {
    const profile = await this.cell.getProfile();
    const memoryContext = await this.cell.buildMemoryContext();

    const prompt = `
    你是 ${this.cell.name} 的自我思考模組。

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

    const result = await this.cell.askWithTimeout(prompt, getAiTimeoutMs());
    const thought = result?.text ?? result?.answer ?? "";

    if (!thought.trim()) {
      throw new Error("No thought generated.");
    }

    await this.cell.appendThought(
      block([
        `## ${new Date().toISOString()}`,
        "",
        thought,
        "",
      ])
    );

    await this.cell.increaseMaturity(1);

    return thought.trim();
  }

  async processInbox(inbox = []) {
    if (inbox.length === 0) {
      return {
        processed: 0,
        summary: "",
      };
    }

    const profile = await this.cell.getProfile();

    const prompt = `
  你是 ${this.cell.name} 的訊息代謝模組。

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

    const result = await this.cell.askWithTimeout(prompt, getAiTimeoutMs());
    const summary = result?.text ?? result?.answer ?? "";

    if (!summary.trim()) {
      throw new Error("No inbox summary generated.");
    }

    const timestamp = new Date().toISOString();

    await this.cell.appendThought(
      block([
        `## ${timestamp}`,
        "",
        summary,
        "",
      ])
    );

    await this.cell.appendKnowledge(
      block([
        `## Inbox Processed at ${timestamp}`,
        "",
        summary,
        "",
      ])
    );

    const task = await this.cell.addTask({
      title: `Process inbox from ${inbox.map((m) => m.from).join(", ")}`,
      source: "inbox",
      content: summary.trim(),
    });

    await this.cell.increaseMaturity(1);

    return {
      processed: inbox.length,
      summary: summary.trim(),
      task,
    };
  }
}
