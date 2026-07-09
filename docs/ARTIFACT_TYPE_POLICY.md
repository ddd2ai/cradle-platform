# Artifact Type Policy 實作摘要

**日期**: 2026-07-09

## 目標

讓 Artifact Type 真正約束產出內容:

```
從「能產生 Artifact」
進化到
「能依 Artifact Type 約束產物」
```

---

## 核心設計

### 問題

之前的 `/produce document` 可能產生:
```
outputs/
  src/main/java/com/example/Order.java
  src/main/resources/application.properties
  README.md
```

但 `type=document` 應該只產生 Markdown 文件!

### 解決方案

建立 **Artifact Type Policy** 系統:

1. **定義每種 type 的約束** (policy)
2. **在 prompt 中明確告知 LLM** (prompt-level)
3. **在程式端驗證** (code-level)

---

## 實作內容

### 1. 新增 `artifact-type-policy.js`

定義 6 種 artifact type 的 policy:

| Type | Allowed Languages | Allowed Extensions | Output Rule |
|------|------------------|-------------------|-------------|
| `document` | markdown | .md | 只能產生 Markdown 文件 |
| `code` | js, ts, java, python, sql, json, yaml, properties, markdown | .js, .ts, .java, .py, .sql, .json, .yaml, .yml, .properties, .md | 可產生原始碼、設定檔、SQL、README |
| `diagram` | markdown, mermaid, plantuml | .md, .mmd, .puml | 優先產生 Mermaid/PlantUML |
| `sql` | sql | .sql | 只能產生 SQL script |
| `config` | json, yaml, properties, env | .json, .yaml, .yml, .properties, .env | 只能產生設定檔 |
| `generic` | any | any | 根據需求產生 |

```javascript
export const ARTIFACT_TYPE_POLICIES = {
  document: {
    description: "Markdown document only.",
    allowedLanguages: ["markdown"],
    allowedExtensions: [".md"],
    outputRule: "type=document 時，outputs 只能產生 Markdown 文件...",
  },
  // ... 其他 types
};

export function getArtifactTypePolicy(type = "generic") {
  return ARTIFACT_TYPE_POLICIES[type] ?? ARTIFACT_TYPE_POLICIES.generic;
}
```

### 2. 修改 `production-prompts.js`

在 prompt 中加入 **Artifact Type Policy** 區塊:

```javascript
import { getArtifactTypePolicy } from "./artifact-type-policy.js";

export function buildProductionPrompt({ type, ... } = {}) {
  const policy = getArtifactTypePolicy(type);

  return `
# Artifact Type

${type}

# Artifact Type Policy

Description:
${policy.description}

Allowed Languages:
${policy.allowedLanguages.map((item) => `- ${item}`).join("\n")}

Allowed Extensions:
${policy.allowedExtensions.map((item) => `- ${item}`).join("\n")}

Output Rule:
${policy.outputRule}

# Title
...
`;
}
```

這讓 LLM 在產生 artifact 前就清楚知道約束。

### 3. 修改 `artifact-production-service.js`

加入 **程式端驗證**:

```javascript
async produce({ type, goal, ... }) {
  // ... 呼叫 LLM
  const parsed = parseLooseJsonObject(raw);

  const artifactType = parsed.type ?? type;
  const artifactOutputs = parsed.outputs ?? [];

  // ✅ 驗證 outputs 是否符合 type policy
  this.validateOutputsByType({
    type: artifactType,
    outputs: artifactOutputs,
  });

  // ... 建立 artifact
}

validateOutputsByType({ type, outputs = [] }) {
  if (type !== "document") return;

  const invalidOutputs = outputs.filter((output) => {
    const path = output.path ?? "";
    const language = output.language ?? "";

    return (
      language !== "markdown" ||
      !path.endsWith(".md")
    );
  });

  if (invalidOutputs.length > 0) {
    throw new Error(
      `Invalid document artifact outputs. type=document only allows markdown .md files. Invalid paths: ${invalidOutputs
        .map((output) => output.path)
        .join(", ")}`
    );
  }
}
```

**第一版只驗證 `document` type**。未來可以逐步加入其他 type 的驗證。

---

## 雙層防護

```
Layer 1: Prompt-level
  → 在 prompt 中明確告知 LLM 約束
  → 降低 LLM 產生錯誤 outputs 的機率

Layer 2: Code-level
  → 程式端驗證 outputs 格式
  → 即使 LLM 不聽話也能攔截
  → 拋出清楚的錯誤訊息
```

---

## 測試結果

### 單元測試 1: Policy 定義

```bash
node test/test-artifact-type-policy.js
```

**結果**:
```
🧪 Artifact Type Policy 測試

📋 支援的 Artifact Types:
  - document
  - code
  - diagram
  - sql
  - config
  - generic

✅ 測試 getArtifactTypePolicy()

✓ document policy: Markdown document only.
✓ code policy: Source code files.
✓ unknown type fallback: Generic artifact.

🎉 所有測試通過!
```

### 單元測試 2: 驗證邏輯

```bash
node test/test-artifact-validation.js
```

**結果**:
```
🧪 Artifact Outputs 驗證測試

測試 1: document type 只允許 .md 檔案

✅ 有效的 document outputs: 通過
✅ 正確攔截無效 document outputs
   錯誤訊息: Invalid document artifact outputs. type=document only allows markdown .md files. Invalid paths: src/main/java/App.java

測試 2: code type 允許多種檔案類型

✅ code type 允許多種檔案: 通過

測試 3: generic type 不驗證

✅ generic type 不做驗證: 通過

🎉 驗證邏輯測試完成!
```

---

## 下一輪測試

### 測試 1: document type

```bash
node src/cradle.js
/use cell-001
/produce document 建立一套電商系統
```

**預期結果**:
```
outputs/
  ecommerce-system-design.md
```

**不應該出現**:
```
outputs/
  src/main/java/...
  src/main/resources/...
```

如果 LLM 還是產生 Java,會看到清楚錯誤:
```
Error: Invalid document artifact outputs. type=document only allows markdown .md files. Invalid paths: src/main/java/Order.java
```

### 測試 2: code type

```bash
/produce code 建立一個 Spring Boot 電商系統起始專案
```

**預期結果**: 可以產生多種檔案
```
outputs/
  src/main/java/com/example/Application.java
  src/main/resources/application.properties
  pom.xml
  README.md
```

這時候產生 Java / properties 是合理的,因為 `type=code`。

---

## 影響範圍

### 新增檔案 (3 個)

1. `src/production/artifact-type-policy.js` - Policy 定義
2. `test/test-artifact-type-policy.js` - Policy 測試
3. `test/test-artifact-validation.js` - 驗證測試

### 修改檔案 (2 個)

1. `src/production/production-prompts.js`
   - Import `getArtifactTypePolicy`
   - 在 prompt 加入 Artifact Type Policy 區塊

2. `src/production/artifact-production-service.js`
   - 加入 `validateOutputsByType()` 方法
   - 在 `produce()` 中呼叫驗證

---

## 設計優勢

### 1. 分層防護

```
Prompt Level → 教育 LLM
Code Level   → 強制驗證
```

### 2. 漸進式實作

```
v1: 只驗證 document type
v2: 加入 sql、config 驗證
v3: 完整驗證所有 types
```

### 3. 清楚的錯誤訊息

```
❌ 舊的: JSON parse error
✅ 新的: Invalid document artifact outputs. type=document only allows markdown .md files. Invalid paths: src/main/java/App.java
```

### 4. 可擴充

```javascript
// 未來可以加更多驗證規則
validateOutputsByType({ type, outputs }) {
  switch (type) {
    case "document":
      return this.validateDocumentOutputs(outputs);
    case "sql":
      return this.validateSqlOutputs(outputs);
    case "config":
      return this.validateConfigOutputs(outputs);
    // ...
  }
}
```

---

## 程式碼統計

- **新增檔案**: 3 個
- **修改檔案**: 2 個
- **新增程式碼**: ~120 行
  - `artifact-type-policy.js`: ~80 行
  - `production-prompts.js`: ~15 行
  - `artifact-production-service.js`: ~25 行

---

## Production Layer 進化階段

```
✅ 第一階段：能產生 Artifact
✅ 第二階段：能依 Artifact Type 約束產物 ← 當前完成
⏳ 第三階段：能 Review Artifact
⏳ 第四階段：能 Revise Artifact
⏳ 第五階段：能 Publish / Apply Artifact
```

---

## 關鍵價值

### Before

```
/produce document 建立電商系統

→ LLM 產生 Java + SQL + YAML
→ 收下髒 artifact
→ 使用者困惑: 為什麼 document 有 Java?
```

### After

```
/produce document 建立電商系統

→ Prompt 告知: type=document 只能產生 .md
→ LLM 產生 Java + Markdown
→ 驗證攔截: Invalid document artifact outputs
→ 拋出清楚錯誤
→ 或 LLM 聽話只產生 .md
```

---

## 下一步建議

### 立即執行

1. **測試 document type**:
   ```bash
   /produce document 建立電商系統設計文件
   ```
   - 驗證只產生 .md
   - 驗證 LLM 是否遵守 policy

2. **測試 code type**:
   ```bash
   /produce code 建立 Spring Boot 專案結構
   ```
   - 驗證可以產生多種檔案
   - 驗證不會被 document 驗證攔截

### 未來擴充

1. **加入更多 type 驗證**:
   ```javascript
   validateSqlOutputs(outputs) { ... }
   validateConfigOutputs(outputs) { ... }
   ```

2. **加入更細緻的規則**:
   ```javascript
   // document type 不能超過 3 個檔案
   // code type 必須包含 README.md
   // sql type 不能包含 DDL 和 DML 混合
   ```

3. **加入警告模式**:
   ```javascript
   // 不符合 policy 但不致命,只記錄警告
   warnIfNotIdeal(type, outputs);
   ```

---

## 結論

這一刀完成了 **Artifact Type Policy** 系統:

1. ✅ 定義了 6 種 artifact type 的約束
2. ✅ 在 prompt 中告知 LLM
3. ✅ 在程式端驗證 (先驗證 document)
4. ✅ 雙層防護確保 artifact 品質

### 核心成果

```
從「能產生」
進化到
「按類型正確產生」
```

Production Layer 正式進入**第二階段**! 🎉
