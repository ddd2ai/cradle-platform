# Artifact Type Policy - 快速參考

## 支援的 Artifact Types

| Type | Description | 允許的語言 | 允許的副檔名 |
|------|------------|----------|------------|
| `document` | Markdown 文件 | markdown | .md |
| `code` | 原始碼 | js, ts, java, python, sql, json, yaml, properties, markdown | .js, .ts, .java, .py, .sql, .json, .yaml, .yml, .properties, .md |
| `diagram` | 圖表文件 | markdown, mermaid, plantuml | .md, .mmd, .puml |
| `sql` | SQL 腳本 | sql | .sql |
| `config` | 設定檔 | json, yaml, properties, env | .json, .yaml, .yml, .properties, .env |
| `generic` | 通用 | any | any |

---

## Output Rules

### document
```
type=document 時，outputs 只能產生 Markdown 文件，
不可產生 Java、SQL、JSON、YAML、properties 或其他程式碼檔案。
```

**✅ 正確**:
```
outputs/
  design.md
  architecture.md
  README.md
```

**❌ 錯誤**:
```
outputs/
  src/main/java/App.java    ← 不允許
  config.yaml                ← 不允許
```

---

### code
```
type=code 時，可以產生原始碼、設定檔、SQL、README，
但每個檔案必須是完整可落檔內容。
```

**✅ 正確**:
```
outputs/
  src/main/java/Application.java
  src/main/resources/application.properties
  pom.xml
  README.md
```

---

### diagram
```
type=diagram 時，outputs 應優先產生 Mermaid markdown 或 PlantUML，
不可產生應用程式原始碼。
```

**✅ 正確**:
```
outputs/
  system-architecture.md     (含 Mermaid)
  dataflow.mmd
  sequence.puml
```

**❌ 錯誤**:
```
outputs/
  diagram.md
  src/main/java/App.java     ← 不允許
```

---

### sql
```
type=sql 時，outputs 只能產生 SQL script，
不可產生 Java 或 Markdown 設計文件。
```

**✅ 正確**:
```
outputs/
  schema.sql
  init-data.sql
  migrations/001-create-users.sql
```

**❌ 錯誤**:
```
outputs/
  schema.sql
  README.md                   ← 不允許
```

---

### config
```
type=config 時，outputs 只能產生設定檔。
```

**✅ 正確**:
```
outputs/
  application.yaml
  database.properties
  .env
```

---

### generic
```
type=generic 時，可以根據需求產生合理 artifact，
但仍需保持 outputs 類型一致。
```

不做嚴格驗證,由 LLM 自行判斷合理性。

---

## 驗證行為

### 目前實作

只驗證 `document` type:

```javascript
if (type === "document") {
  // 檢查所有 outputs 都是 .md 且 language=markdown
  // 如果有任何非 markdown 檔案,拋出錯誤
}
```

### 錯誤訊息範例

```
Error: Invalid document artifact outputs. 
type=document only allows markdown .md files. 
Invalid paths: src/main/java/Order.java, config.yaml
```

---

## 使用建議

### 選擇正確的 Type

```bash
# ✅ 只要文件說明
/produce document 設計電商系統架構

# ✅ 需要完整程式碼
/produce code 建立 Spring Boot 電商系統

# ✅ 只要資料庫結構
/produce sql 建立電商資料表

# ✅ 只要設定檔
/produce config 產生 Kubernetes deployment 設定

# ✅ 只要系統圖表
/produce diagram 畫出電商系統架構圖
```

### 如果選錯 Type

```bash
# ❌ 錯誤: document 不能產生程式碼
/produce document 建立完整 Spring Boot 專案

# ✅ 正確: 改用 code
/produce code 建立完整 Spring Boot 專案
```

---

## API 使用

### 取得 Policy

```javascript
import { getArtifactTypePolicy } from "./production/artifact-type-policy.js";

const policy = getArtifactTypePolicy("document");

console.log(policy.description);        // "Markdown document only."
console.log(policy.allowedLanguages);   // ["markdown"]
console.log(policy.allowedExtensions);  // [".md"]
console.log(policy.outputRule);         // "type=document 時..."
```

### 驗證 Outputs

```javascript
// 在 ArtifactProductionService 中
this.validateOutputsByType({
  type: "document",
  outputs: [
    { path: "design.md", language: "markdown" },
  ],
});
```

---

## 測試指令

```bash
# 測試 policy 定義
node test/test-artifact-type-policy.js

# 測試驗證邏輯
node test/test-artifact-validation.js
```

---

## 下一步

1. **完善驗證**: 加入其他 type 的驗證 (sql, config, diagram)
2. **更細緻規則**: 檔案數量限制、必要檔案檢查
3. **警告模式**: 不符合最佳實踐但不致命的警告
