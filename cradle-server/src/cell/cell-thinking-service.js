import { block } from "../utils/text.js";
import { parseLooseJsonObject } from "../utils/json.js";
import {
  getTimeoutMs,
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
    const memoryContext = await this.cell.buildOperationalContext();

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

    const result = await this.cell.askWithTimeout(prompt, getTimeoutMs("reflectionSeconds"));
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

    const delegations = inbox.filter((message) => message.type === "delegation");
    const information = inbox.filter((message) => message.type !== "delegation");
    const tasks = [];

    for (const message of delegations) {
      tasks.push(await this.cell.addTask({
        title: delegationTitle(message),
        source: "inbox-delegation",
        content: delegationContent(message),
      }));
    }

    const deterministicRecord = formatInboxReceipt(inbox, delegations.length);
    let summary = delegations.length > 0
      ? `${delegations.length} delegation(s) queued as durable tasks.`
      : "";

    if (information.length === 0) {
      await this.cell.appendKnowledge(deterministicRecord);
      return {
        processed: inbox.length,
        summary,
        tasks,
        tasksCreated: tasks.length,
        llmCalls: 0,
      };
    }

    const profile = await this.cell.getProfile();

    const prompt = `
  你是 ${this.cell.name} 的訊息代謝模組。

  請整理收到的 inbox，轉化成可長期保存的 Cell 觀察，並判斷是否真的需要建立 task。

  請只輸出 JSON，不要 markdown，不要 code fence：

  {
    "observation": {
      "summary": "重點摘要",
      "facts": ["只列訊息明確包含的事實"],
      "interpretations": ["合理解讀，但不可冒充事實"],
      "unknowns": ["仍缺少的資訊"]
    },
    "tasks": [
      { "title": "只有訊息明確要求行動時才建立", "content": "保留目標與限制" }
    ]
  }

  Rules:
  - 純通知、報告或背景資訊通常不建立 Task。
  - 最多建立 1 個 Task。
  - 不可把猜測轉成 Task。

  ---

  # Profile

  ${JSON.stringify(profile, null, 2)}

  ---

  # Inbox

  ${JSON.stringify(information, null, 2)}
  `;

    const result = await this.cell.askWithTimeout(
      prompt,
      getTimeoutMs("cultivationSeconds"),
    );
    const raw = result?.text ?? result?.answer ?? result ?? "{}";
    const parsed = parseLooseJsonObject(raw);
    const observation = normalizeObservation(parsed.observation);
    const observationMarkdown = formatInboxObservation(observation);
    summary = observation.summary;

    if (!summary.trim()) {
      throw new Error("No inbox summary generated.");
    }

    const timestamp = new Date().toISOString();

    await this.cell.appendThought(
      block([
        `## ${timestamp}`,
        "",
        observationMarkdown,
        "",
      ])
    );

    await this.cell.appendKnowledge(
      block([
        `## Inbox Processed at ${timestamp}`,
        "",
        deterministicRecord,
        "",
        observationMarkdown,
        "",
      ])
    );

    const proposedTask = normalizeTask(parsed.tasks?.[0]);
    if (proposedTask) {
      tasks.push(await this.cell.addTask({
        ...proposedTask,
        source: "inbox",
      }));
    }

    return {
      processed: inbox.length,
      summary: summary.trim(),
      tasks,
      tasksCreated: tasks.length,
      llmCalls: 1,
    };
  }
}

function delegationTitle(message) {
  const excerpt = String(message?.content ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  return `Delegated by ${message?.from ?? "unknown Cell"}: ${excerpt || "Untitled task"}`;
}

function delegationContent(message) {
  return block([
    `messageId: ${message?.id ?? "unknown"}`,
    `from: ${message?.from ?? "unknown"}`,
    `createdAt: ${message?.createdAt ?? "unknown"}`,
    "",
    String(message?.content ?? "").trim(),
  ]);
}

function formatInboxReceipt(inbox, delegationCount) {
  return block([
    `## Inbox Receipt ${new Date().toISOString()}`,
    "",
    `- messages: ${inbox.length}`,
    `- delegations queued: ${delegationCount}`,
    ...inbox.map((message) =>
      `- ${message?.id ?? "unknown"}: ${message?.type ?? "message"} from ${message?.from ?? "unknown"}`
    ),
  ]);
}

function normalizeObservation(value) {
  return {
    summary: String(value?.summary ?? "").trim(),
    facts: strings(value?.facts),
    interpretations: strings(value?.interpretations),
    unknowns: strings(value?.unknowns),
  };
}

function formatInboxObservation(observation) {
  return block([
    "## Inbox Observation",
    "",
    observation.summary,
    "",
    "### Facts",
    ...listItems(observation.facts),
    "",
    "### Interpretations",
    ...listItems(observation.interpretations),
    "",
    "### Unknowns",
    ...listItems(observation.unknowns),
  ]);
}

function normalizeTask(value) {
  const title = String(value?.title ?? "").trim();
  if (!title) return null;
  return {
    title: title.slice(0, 240),
    content: String(value?.content ?? title).trim(),
  };
}

function strings(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function listItems(items) {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- (none)"];
}
