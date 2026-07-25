import { getAiTimeoutMs } from "../cradle-config.js";
import { block } from "../utils/text.js";

export class CellTaskProcessingService {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellTaskProcessingService requires cell");
    }

    this.cell = cell;
  }

  async processTask(task) {
    const result = await this.cell.askWithTimeout(
      `
    你是 ${this.cell.id}。

    請根據你的 DNA、Memory、Vision、Environment,處理以下任務。

    # Task

    ${task.title}

    # Content

    ${task.content || "(empty)"}

    請輸出：
    - 任務理解
    - 執行結果
    - 下一步建議
    `,
      getAiTimeoutMs()
    );

    const outputText =
      result?.text ??
      result?.answer ??
      "(response streamed)";

    const filename =
      `tasks/task-result-${this.cell.formatTimestamp(new Date())}.md`;

    await this.cell.writeWorkspaceFile(
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

    await this.cell.appendHistory(
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

    await this.cell.appendThought(
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

    await this.cell.mature(1);

    return {
      file: filename,
      text: outputText,
    };
  }
}
