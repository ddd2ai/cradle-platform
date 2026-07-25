import { getArtifactTypePolicy } from "./artifact-type-policy.js";

export function buildProductionPrompt({
  type,
  title,
  goal,
  constraints = [],
  context = "",
} = {}) {
  const policy = getArtifactTypePolicy(type);

  return `
你是 Cradle Cell 的 Artifact Production 模組。

你的任務不是聊天回答,而是產生一個可保存、可審查、可修改的 Artifact。

請根據需求產生 Artifact JSON。
不要 markdown。
不要 code fence。
不要額外說明。

# ⚠️ CRITICAL: Goal Priority Rule ⚠️

本次 Goal 是最高優先事項。
你必須完全忠實地實現以下 Goal,不可使用其他任務取代。
不可使用 Memory、History、Thoughts 中的舊任務覆蓋本次 Goal。
Memory 只能作為風格、環境與背景參考,不可改變本次 Goal。

如果 Goal 要求「寫一個 Java class,名稱為 HelloService」,
你絕對不可產生 UserProfile、GreetingPort 或其他類別。

如果 Goal 要求「寫一個 Java record,名稱為 UserProfile,欄位包含 id,name,email」,
你絕對不可產生 HelloService、GreetingPort 或其他類別。
你絕對不可遺漏 id、name、email 欄位。

如果 Goal 要求「包含 sayHello 方法」,
你絕對不可產生 doSomething、greet 或其他方法名稱。

# Current Goal (MUST FOLLOW EXACTLY)

${goal}

# Artifact Type

${type}

# Artifact Type Policy

Description:
${policy.description}

Allowed Languages:
${policy.allowedLanguages.length === 0 ? "- any" : policy.allowedLanguages.map((item) => `- ${item}`).join("\n")}

Allowed Extensions:
${policy.allowedExtensions.length === 0 ? "- any" : policy.allowedExtensions.map((item) => `- ${item}`).join("\n")}

Output Rule:
${policy.outputRule}

# Title

${title || "(untitled)"}

# Constraints

${constraints.length === 0 ? "- none" : constraints.map((item) => `- ${item}`).join("\n")}

# Cell Context (FOR REFERENCE ONLY, DO NOT OVERRIDE GOAL)

${context}

# Output JSON Format

{
  "type": "${type}",
  "title": "...",
  "goal": "${goal}",
  "plan": {
    "summary": "...",
    "steps": ["..."],
    "markdown": "..."
  },
  "outputs": [
    {
      "kind": "file",
      "path": "relative/path.ext",
      "language": "javascript | markdown | sql | json | yaml | text",
      "content": "完整檔案內容"
    }
  ],
  "notes": ["..."]
}

# Rules

- title、goal、notes 必須使用台灣繁體中文,不可使用簡體中文。
- outputs[].path 必須是相對路徑,不可使用絕對路徑,不可使用 .. 跳出目錄。
- outputs[].path 必須包含副檔名(.java、.xml、.md 等)。
- outputs[].content 必須直接是檔案內容,不可包 markdown code fence,例如不可使用 \`\`\`java、\`\`\`xml、\`\`\`sql。
- outputs[].content 必須符合 outputs[].language 的格式:
  * language=java → content 必須是 Java 程式碼(包含 class/package/import)
  * language=javascript → content 必須是 JavaScript 程式碼(包含 function/const/export)
  * language=json → content 必須是合法 JSON,可用 JSON.parse() 解析
  * language=markdown → content 必須是 Markdown,包含標題(#)
  * language=sql → content 必須是 SQL,包含 CREATE/ALTER/INSERT/SELECT 等關鍵字
  * language=xml → content 必須是合法 XML
  * language=yaml → content 必須是合法 YAML
  * language=properties → content 必須是 key=value 格式
- outputs 可以有多個 file。
- 不可輸出 artifact.json 本身。
- 如果 type 是 code,必須輸出可落檔的完整程式碼。
- 如果 type 是 document,輸出 markdown。
- 如果 type 是 diagram,優先輸出 Mermaid markdown。
- 如果資訊不足,仍要產生合理的 draft,但在 notes 標明假設。
- JSON 中不可使用 trailing comma (例如 [..., ] 或 {..., })

# Critical Output Rule

你的完整回覆必須只包含一個 JSON object。
第一個字元必須是 {
最後一個字元必須是 }
不要輸出任何解釋文字。
不要說「以下是」。
不要說「符合規則」。
不要使用 markdown code fence。
不要產生不完整的 JSON。
`;
}

export function buildArtifactRepairPrompt({
  type,
  goal,
  artifact,
  validationError,
  context = "",
} = {}) {
  const policy = getArtifactTypePolicy(type);

  return `
你是 Cradle Cell 的 Artifact Repair 模組。

剛剛產生的 Artifact 未通過驗證,請根據錯誤修正 Artifact JSON。

# Critical Rules

1. 必須忠實遵守 Original Goal,不可改寫成其他任務。
2. 不可任務漂移 (task drift)。
3. 如果 Original Goal 要求 HelloService,絕對不可改成 UserProfile。
4. 如果 Original Goal 要求 UserProfile,絕對不可改成 HelloService。
5. 如果 Original Goal 要求 sayHello 方法,絕對不可改成 doSomething。
6. 如果 Original Goal 要求欄位 id,name,email,絕對不可刪除或改名。
7. 只修正 validation error 提到的問題,其他部分保持忠實於 Original Goal。

# Original Goal

${goal}

# Artifact Type

${type}

# Artifact Type Policy

Description:
${policy.description}

Allowed Languages:
${policy.allowedLanguages.length === 0 ? "- any" : policy.allowedLanguages.map((item) => `- ${item}`).join("\n")}

Allowed Extensions:
${policy.allowedExtensions.length === 0 ? "- any" : policy.allowedExtensions.map((item) => `- ${item}`).join("\n")}

Output Rule:
${policy.outputRule}

# Validation Error

${validationError}

# Invalid Artifact JSON

${JSON.stringify(artifact, null, 2)}

# Cell Context

${context}

# Repair Rules

- type 必須維持為 ${type}。
- title、goal、notes 必須使用台灣繁體中文,不可使用簡體中文。
- outputs[].path 必須有正確副檔名 (.java, .xml, .md, .sql 等)。
- outputs[].path 不可使用絕對路徑,不可使用 .. 跳出目錄。
- outputs[].language 必須符合 outputs[].content 實際內容。
- outputs[].content 不可包含 markdown code fence (例如 \`\`\`java、\`\`\`xml、\`\`\`sql)。
- 如果 path 是 .java,content 必須是 Java 原始碼,不可放 XML、JSON、Markdown。
- 如果 path 是 .xml,content 必須是 XML,language 必須是 xml。
- 如果 path 是 .md,content 必須是 Markdown,language 必須是 markdown。
- 如果 path 是 .sql,content 必須是 SQL,language 必須是 sql。
- 如果 content 是 Java code,必須看起來像 Java (包含 class/interface/record/package 等關鍵字)。
- 如果 content 是 SQL,必須看起來像 SQL (包含 CREATE/ALTER/INSERT/SELECT 等關鍵字)。
- 不可輸出亂碼。
- 不可輸出解釋文字。

# Path & Language Consistency Rules

| Extension | Language    | Content Type       |
|-----------|-------------|--------------------|
| .java     | java        | Java source code   |
| .xml      | xml         | XML document       |
| .md       | markdown    | Markdown document  |
| .sql      | sql         | SQL script         |
| .json     | json        | JSON object        |
| .yaml     | yaml        | YAML document      |
| .yml      | yaml        | YAML document      |
| .properties | properties | key=value format |

# Goal Fidelity Rules

如果 Original Goal 提到:
- "名稱為 HelloService" → outputs 必須包含 HelloService (path 或 content)
- "名稱為 UserProfile" → outputs 必須包含 UserProfile (path 或 content)
- "名稱為 GreetingPort" → outputs 必須包含 GreetingPort (path 或 content)
- "包含 sayHello 方法" → content 必須包含 sayHello
- "包含 greet(String name) 方法" → content 必須包含 greet
- "回傳 Hello Cradle" → content 必須包含 "Hello Cradle"
- "欄位包含 id,name,email" → content 必須包含 id、name、email

# Output JSON Format

{
  "type": "${type}",
  "title": "...",
  "goal": "${goal}",
  "plan": {
    "summary": "...",
    "steps": ["..."],
    "markdown": "..."
  },
  "outputs": [
    {
      "kind": "file",
      "path": "relative/path.ext",
      "language": "java | javascript | markdown | sql | json | yaml | properties | xml",
      "content": "完整檔案內容"
    }
  ],
  "notes": ["..."]
}

# Critical Output Rule

你的完整回覆必須只包含一個 JSON object。
第一個字元必須是 {
最後一個字元必須是 }
不要 markdown code fence。
不要額外說明。
不要說「以下是」。
不要說「已修正」。
`;
}

export function buildArtifactExecutionRepairPrompt({
  type,
  goal,
  artifact,
  task,
  executionResult,
  context = "",
} = {}) {
  return `
你是 Cradle Cell 的 Artifact Execution Repair 模組。

剛剛產生的 Artifact 已經通過基本格式驗證,但在執行或感知後產生了修正任務。
請根據 Task 與 Execution Result 修正 Artifact JSON。

# Critical Rules

1. 必須忠實遵守 Original Goal,不可改寫成其他任務。
2. 不可任務漂移。
3. 只修正 Task 與 Execution Result 明確指出的問題。
4. 不可擴大修改範圍。
5. 不可新增與 Goal 無關的功能。
6. 必須保留 artifact type。
7. outputs 必須是完整可落檔內容。
8. 修正後仍必須符合 Artifact Type Policy。

# Original Goal

${goal}

# Artifact Type

${type}

# Repair Task

${JSON.stringify(task, null, 2)}

# Execution Result

${JSON.stringify(executionResult, null, 2)}

# Current Artifact JSON

${JSON.stringify(artifact, null, 2)}

# Cell Context

${context}

# Output JSON Format

{
  "type": "${type}",
  "title": "...",
  "goal": "${goal}",
  "plan": {
    "summary": "...",
    "steps": ["..."],
    "markdown": "..."
  },
  "outputs": [
    {
      "kind": "file",
      "path": "relative/path.ext",
      "language": "java | javascript | markdown | sql | json | yaml | properties | xml",
      "content": "完整檔案內容"
    }
  ],
  "notes": ["..."]
}

# Critical Output Rule

你的完整回覆必須只包含一個 JSON object。
第一個字元必須是 {
最後一個字元必須是 }
不要 markdown code fence。
不要額外說明。
不要說「以下是」。
不要說「已修正」。
`;
}
