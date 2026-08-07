import { getArtifactTypePolicy } from "./artifact-type-policy.js";

function formatJson(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function formatSourceArtifacts(sourceArtifacts) {
  if (!sourceArtifacts?.length) {
    return "- none";
  }

  return sourceArtifacts.map((artifact, index) => [
    `## Source Artifact ${index + 1}: ${artifact.id ?? "unknown"}`,
    formatJson(artifact),
  ].join("\n")).join("\n\n");
}

export function buildDivisionProductPairPrompt({
  type,
  parentCellId,
  childCellId,
  parentTitle,
  childTitle,
  parentGoal,
  childGoal,
  parentLivingContext,
  childLivingContext,
  childMemorySeed,
  sharedContracts = [],
  constraints = [],
  parentEnvironment = "",
  childEnvironment = "",
  sourceArtifacts = [],
  sourceWarnings = [],
} = {}) {
  const policy = getArtifactTypePolicy(type);

  return `
你是 Cradle 母細胞 ${parentCellId} 的細胞分裂產物協調器。

你必須在這一次回覆中，同時設計並產生母細胞與子細胞的完整產物，以及兩者實際使用的 API invocation contract。
這是唯一一次生成機會。不可要求子細胞稍後補完，也不可輸出兩套彼此猜測的 endpoint。

# Cells

- Parent Cell: ${parentCellId}
- Child Cell: ${childCellId}

# Parent Product

- Title: ${parentTitle}
- Goal:
${parentGoal}
- Living Context:
${formatJson(parentLivingContext)}
- Environment:
${parentEnvironment}

# Child Product

- Title: ${childTitle}
- Goal:
${childGoal}
- Living Context:
${formatJson(childLivingContext)}
- Memory Seed:
${formatJson(childMemorySeed)}
- Environment:
${childEnvironment}

# Planned Shared Contracts

${formatJson(sharedContracts)}

# Source Artifacts

${formatSourceArtifacts(sourceArtifacts)}

# Source Warnings

${sourceWarnings.length ? sourceWarnings.map((warning) => `- ${warning}`).join("\n") : "- none"}

# Constraints

${constraints.length ? constraints.map((constraint) => `- ${constraint}`).join("\n") : "- none"}

# Artifact Policy

- Type: ${type}
- Description: ${policy.description}
- Allowed languages: ${policy.allowedLanguages.length ? policy.allowedLanguages.join(", ") : "any"}
- Allowed extensions: ${policy.allowedExtensions.length ? policy.allowedExtensions.join(", ") : "any"}
- Output rule: ${policy.outputRule}

# Required Collaboration Rules

1. productContract.apiInvocations 至少要有一筆。
2. 每筆 invocation 必須指定 sourceRole、targetRole、method、path、requestSchema、responseSchema。
3. sourceRole 與 targetRole 只能是 parent 或 child，且不可相同。
4. 呼叫方產物必須真的包含使用相同 HTTP method 與完整 path 的 client/adapter。
5. 被呼叫方產物必須真的包含使用相同 HTTP method 與完整 path 的 controller/endpoint。
6. requestSchema 與 responseSchema 必須由雙方共同遵守；欄位需明確列出名稱與型別。
7. 若有 callback，必須另外建立一筆反方向 invocation，且雙方都要實作。
8. 不可只在 notes、README 或 contract metadata 宣稱已連線；可執行程式碼中必須出現相同 method 與 path。
9. 兩個產物都必須完整可落檔，不可包含 TODO、placeholder 或要求另一個 Cell 日後補完。

# Output JSON Format

{
  "parentProduct": {
    "type": "${type}",
    "title": "...",
    "plan": { "summary": "...", "steps": ["..."], "markdown": "..." },
    "outputs": [
      { "kind": "file", "path": "relative/path.ext", "language": "...", "content": "完整檔案內容" }
    ],
    "notes": ["..."]
  },
  "childProduct": {
    "type": "${type}",
    "title": "...",
    "plan": { "summary": "...", "steps": ["..."], "markdown": "..." },
    "outputs": [
      { "kind": "file", "path": "relative/path.ext", "language": "...", "content": "完整檔案內容" }
    ],
    "notes": ["..."]
  },
  "productContract": {
    "apiInvocations": [
      {
        "contractName": "...",
        "sourceRole": "parent",
        "targetRole": "child",
        "method": "POST",
        "path": "/api/example",
        "requestSchema": [{ "name": "field", "type": "string", "required": true }],
        "responseSchema": [{ "name": "field", "type": "string", "required": true }]
      }
    ]
  }
}

# Output Rules

- 完整回覆只能是一個 JSON object，不要 markdown code fence 或額外說明。
- 第一個字元必須是 {，最後一個字元必須是 }。
- title 與 notes 使用台灣繁體中文，不可使用簡體中文。
- outputs[].path 必須是含副檔名的相對路徑，不可包含 ..。
- outputs[].content 是完整檔案內容，不可包 markdown code fence。
- 不可自行提供 artifact ID；Cradle 會在驗證後配置 ID。
`;
}
