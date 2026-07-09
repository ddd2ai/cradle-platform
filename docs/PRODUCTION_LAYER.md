# Cradle Production Layer

## 概述

Production Layer 是 Cradle Cell 的「創造器官」,負責將意圖轉化為可保存、可審查、可修改的 Artifact。

**核心設計理念:**

```
現在:
Cell.produceArtifact()
  → 建立 Production
  → 產生 Artifact JSON
  → 寫入 workspace/productions
  → 可 review
  → 可 publish/apply (未來實作)
```

與傳統「程式碼產生器」的差異:

- ❌ 不是 `generateCode()`
- ✅ 是 `produceArtifact()`
- Code 只是 Artifact 的一種 type
- Artifact 是第一級概念

---

## 架構

### 目錄結構

```
src/production/
  ├── artifact-schema.js          # Artifact 資料結構定義
  ├── artifact-store.js           # Artifact 落檔與讀取
  ├── artifact-production-service.js  # Production 流程控制
  └── production-prompts.js       # Production Prompt 建構

cells/{cell-id}/workspace/
  ├── productions/                # 產出的 Artifact
  │   └── artifact-{timestamp}/
  │       ├── artifact.json       # Artifact metadata
  │       ├── plan.md             # 執行計畫
  │       └── outputs/            # 產出檔案
  ├── reviews/                    # 審查紀錄 (未來)
  └── publications/               # 發布紀錄 (未來)
```

---

## Artifact Schema

### Artifact Types

- `code` - 程式碼
- `document` - 文件
- `diagram` - 圖表 (Mermaid/PlantUML)
- `sql` - SQL 腳本
- `config` - 設定檔
- `test` - 測試案例
- `prompt` - Prompt 模板
- `decision` - 設計決策
- `research` - 研究筆記
- `spec` - 規格文件
- `task` - 任務定義
- `generic` - 通用 Artifact

### Artifact Statuses

- `draft` - 草稿
- `reviewed` - 已審查
- `revised` - 已修訂
- `published` - 已發布
- `rejected` - 已拒絕

### Artifact 結構

```json
{
  "id": "artifact-20260709-143022",
  "type": "code",
  "title": "User Authentication Module",
  "status": "draft",
  "goal": "建立使用者認證模組",
  
  "context": {
    "cellId": "cell-001",
    "provider": "copilot",
    "model": "gpt-5-mini"
  },
  
  "plan": {
    "summary": "...",
    "steps": ["..."],
    "markdown": "..."
  },
  
  "outputs": [
    {
      "kind": "file",
      "path": "auth/user-auth.js",
      "language": "javascript",
      "content": "..."
    }
  ],
  
  "notes": ["..."],
  
  "review": {
    "status": "pending",
    "notes": []
  },
  
  "createdAt": "2026-07-09T14:30:22.000Z",
  "updatedAt": "2026-07-09T14:30:22.000Z"
}
```

---

## 使用方式

### 指令

```bash
# 產生 Artifact
/produce <type> <goal>

# 列出所有 Artifacts
/artifacts
```

### 範例

```bash
# 產生文件
/produce document 說明 Cradle Artifact Production Layer 的設計

# 產生圖表
/produce diagram 畫出 Cradle Cell 的生產流程，用 Mermaid 表示

# 產生程式碼
/produce code 新增一個 JavaScript 函式，可以安全解析 LLM 回傳的 JSON
```

---

## API

### CradleCell

```javascript
// 產生 Artifact
const result = await cell.produceArtifact({
  type: 'code',
  goal: '建立使用者認證模組',
  title: '使用者認證模組',
  constraints: [
    '使用 JWT',
    '支援 OAuth2',
  ],
});

console.log(result.artifact.id);    // artifact-20260709-143022
console.log(result.saved.dir);       // cells/cell-001/workspace/productions/artifact-20260709-143022
```

### ArtifactProductionService

```javascript
const service = new ArtifactProductionService({
  cell,
  assistant,
  productionsDir: '/path/to/productions',
});

const result = await service.produce({
  type: 'document',
  goal: '說明系統架構',
  title: '系統架構說明',
});
```

### ArtifactStore

```javascript
const store = new ArtifactStore({
  productionsDir: '/path/to/productions',
});

// 儲存 Artifact
await store.saveArtifact(artifact);

// 讀取 Artifact
const artifact = await store.readArtifact('artifact-20260709-143022');

// 列出所有 Artifacts
const ids = await store.listArtifacts();
```

---

## 設計原則

### 1. Artifact 是第一級概念

不要讓 Cell 長出:
```javascript
writeCodeFile()
writeSqlFile()
writeDiagramFile()
writeTestFile()
```

這會回到傳統專案式窮舉。

### 2. Production Service 負責流程

`CradleCell` 只暴露 `produceArtifact()`,底層流程交給 production layer:

```javascript
Cell.produceArtifact() 
  → ProductionService.produce()
    → 建構 Prompt
    → 呼叫 Assistant
    → 解析結果
    → ArtifactStore.saveArtifact()
    → 記錄 History & Thought
    → Cell.mature()
```

### 3. 先產生草稿,再審查發布

第一版流程:
```
produce → artifact draft
```

未來擴充:
```
produce → review → publish → apply
```

暫時不要做 `apply` (覆蓋原始碼),等驗證抽象層正確再擴充。

---

## 未來擴充

### Review Layer

```javascript
// 審查 Artifact
await cell.reviewArtifact('artifact-20260709-143022');

// 修訂 Artifact
await cell.reviseArtifact('artifact-20260709-143022', {
  feedback: '請加上錯誤處理',
});
```

### Publication Layer

```javascript
// 發布 Artifact (寫入 publications/)
await cell.publishArtifact('artifact-20260709-143022');

// 套用 Artifact (覆蓋原始碼)
await cell.applyArtifact('artifact-20260709-143022', {
  target: '/path/to/project',
});
```

### Type-Specific Producers

```javascript
// 未來可拆分專門的 Producer
class CodeProducer extends ArtifactProducer {
  // Code 專用邏輯
}

class DiagramProducer extends ArtifactProducer {
  // Diagram 專用邏輯
}
```

---

## 實作清單

- [x] 步驟 1: 建立 production 目錄結構
- [x] 步驟 2: 定義 Artifact Schema
- [x] 步驟 3: 實作 ArtifactStore
- [x] 步驟 4: 建立 Production Prompt
- [x] 步驟 5: 實作 ArtifactProductionService
- [x] 步驟 6: 修改 CradleCell 整合 productionService
- [x] 步驟 7: 新增 production commands 並整合到 engine

---

## 測試建議

### 測試順序

1. **先測 document** (最容易驗證格式)
   ```bash
   /use cell-001
   /produce document 說明 Cradle Artifact Production Layer 的設計
   /artifacts
   ```

2. **再測 diagram**
   ```bash
   /produce diagram 畫出 Cradle Cell 的生產流程，用 Mermaid 表示
   ```

3. **最後測 code**
   ```bash
   /produce code 新增一個 JavaScript 函式，可以安全解析 LLM 回傳的 JSON
   ```

### 驗證點

- [ ] Artifact JSON 格式正確
- [ ] outputs/ 檔案正常落檔
- [ ] plan.md 正確產生
- [ ] Cell history 正確記錄
- [ ] Cell thought 正確記錄
- [ ] Cell maturity 正確增加

---

## 結論

這次重構不是做「程式碼產生器」,而是讓 Cradle 長出:

```
Cell 的創造器官
```

Code 只是它第一次學會生產的高價值 artifact。

這樣的抽象層才能撐得住未來的 Cradle。
