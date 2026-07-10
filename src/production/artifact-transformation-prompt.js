/**
 * artifact-transformation-prompt.js
 * 
 * Artifact Transformation Prompt
 * 用於 Cell Division/Fusion 時重新生成 Artifact
 */

import { getArtifactTypePolicy } from "./artifact-type-policy.js";

export function buildArtifactTransformationPrompt({
  type,
  title,
  goal,
  constraints = [],
  environment = "",
  livingContext,
  distilledMemory,
  sourceArtifacts = [],
  origin
} = {}) {
  const policy = getArtifactTypePolicy(type);

  // 建立 Living Context 摘要
  let livingContextText = "";
  if (livingContext) {
    livingContextText = `
# Target Living Context (PRIMARY BOUNDARY)

**Purpose**: ${livingContext.purpose || "N/A"}

**Responsibilities**:
${livingContext.responsibilities && livingContext.responsibilities.length > 0
  ? livingContext.responsibilities.map(r => `- ${r}`).join("\n")
  : "- None"}

**Owns**:
${livingContext.owns && livingContext.owns.length > 0
  ? livingContext.owns.map(o => `- ${o}`).join("\n")
  : "- None"}

**Excludes** (MUST NOT include these in the artifact):
${livingContext.excludes && livingContext.excludes.length > 0
  ? livingContext.excludes.map(e => `- ${e}`).join("\n")
  : "- None"}

**Inputs**:
${livingContext.inputs && livingContext.inputs.length > 0
  ? livingContext.inputs.map(i => `- ${i}`).join("\n")
  : "- None"}

**Outputs**:
${livingContext.outputs && livingContext.outputs.length > 0
  ? livingContext.outputs.map(o => `- ${o}`).join("\n")
  : "- None"}

**Constraints**:
${livingContext.constraints && livingContext.constraints.length > 0
  ? livingContext.constraints.map(c => `- ${c}`).join("\n")
  : "- None"}
`;
  }

  // 建立 Distilled Memory 摘要
  let memoryText = "";
  if (distilledMemory) {
    memoryText = `
# Distilled Memory (KNOWLEDGE REFERENCE)

## Knowledge
${distilledMemory.knowledge || "N/A"}

## History
${distilledMemory.history || "N/A"}
`;
  }

  // 建立 Source Artifacts 摘要
  let sourceArtifactsText = "";
  if (sourceArtifacts && sourceArtifacts.length > 0) {
    sourceArtifactsText = "\n# Source Artifacts (REFERENCE MATERIAL ONLY)\n\n";
    sourceArtifactsText += "These are source artifacts from parent cell(s). They are REFERENCE MATERIAL, NOT mandatory templates.\n\n";

    sourceArtifacts.forEach((artifact, index) => {
      sourceArtifactsText += `## Source Artifact ${index + 1}: ${artifact.id}\n\n`;
      sourceArtifactsText += `**Type**: ${artifact.type}\n`;
      sourceArtifactsText += `**Title**: ${artifact.title}\n`;
      sourceArtifactsText += `**Goal**: ${artifact.goal}\n\n`;

      if (artifact.outputs && artifact.outputs.length > 0) {
        sourceArtifactsText += "**Outputs**:\n\n";
        artifact.outputs.forEach(output => {
          sourceArtifactsText += `### ${output.path}\n\n`;
          if (output.content) {
            sourceArtifactsText += "```\n";
            sourceArtifactsText += output.content;
            sourceArtifactsText += "\n```\n\n";
          }
          if (output.truncated) {
            sourceArtifactsText += "*[Content truncated]*\n\n";
          }
        });
      }

      sourceArtifactsText += "\n";
    });
  }

  // Origin 資訊
  let originText = "";
  if (origin) {
    originText = `
# Origin Context

This artifact is being generated for a **${origin.mode}** operation.
${origin.sourceCellIds && origin.sourceCellIds.length > 0
  ? `Parent Cell(s): ${origin.sourceCellIds.join(", ")}`
  : ""}
`;
  }

  return `
你是 Cradle Cell 的 Artifact Transformation 模組。

你的任務是根據 **新的 Living Context** 與 **參考資料** 重新產生一個 Artifact。

請根據需求產生 Artifact JSON。
不要 markdown。
不要 code fence。
不要額外說明。

${originText}

# ⚠️ CRITICAL: Priority Order ⚠️

你必須嚴格遵循以下優先順序:

1. **Current Goal** (最高優先)
2. **Target Living Context** (定義責任邊界)
3. **Constraints**
4. **Distilled Memory** (知識參考)
5. **Source Artifacts** (參考素材,不是必須保留的結構)

## 重要規則

- **Source Artifacts 只是原料與證據,不是必須保留的目標結構**
- **不可機械複製 Source Artifacts**
- **不可保留 Target Living Context "excludes" 中明確排除的責任**
- **跨邊界依賴應轉換為 interface、port、event、contract 或明確的 inputs/outputs**
- **產物必須是完整可落檔內容,不可只是框架或 TODO**
- **不可輸出 Source Artifact 原始 artifact ID 作為新 Artifact ID**

# Current Goal (MUST FOLLOW EXACTLY)

${goal}

${livingContextText}

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

# Environment (Technical Stack Reference)

${environment}

${memoryText}

${sourceArtifactsText}

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
- outputs[].content 必須符合 outputs[].language 的格式。
- 必須產生完整可用的檔案內容,不可只是框架或 TODO placeholder。
- 不可複製 Source Artifact 的原始 ID。

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
