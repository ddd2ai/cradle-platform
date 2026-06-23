# LLM Provider 遷移指南

## 概述

本指南說明如何從舊的 `cradle-ai.js` 架構遷移到新的 Provider 架構。

---

## 重大變更

### 1. `createCradleAssistant` 參數變更

#### 舊架構 (已棄用)

```js
const assistant = await createCradleAssistant({
  model: "gpt-4.1",  // ❌ 已移除
  onDelta,
  onIdle,
  onError,
  logDir,
  cellId,
  cellName,
});
```

#### 新架構 (推薦)

```js
import { createCopilotProvider } from "./providers/copilot-provider.js";

const provider = await createCopilotProvider({
  model: "gpt-4.1",
});

const assistant = await createCradleAssistant({
  provider,  // ✅ 新增: 必需參數
  onDelta,
  onIdle,
  onError,
  logDir,
  cellId,
  cellName,
});
```

---

## 遷移步驟

### 步驟 1: 匯入 Provider

在檔案頂部加入 provider 匯入:

```js
// 使用 Copilot
import { createCopilotProvider } from "./providers/copilot-provider.js";

// 或使用 Ollama
import { createOllamaProvider } from "./providers/ollama-provider.js";
```

### 步驟 2: 建立 Provider

在建立 assistant 之前先建立 provider:

```js
// Copilot
const provider = await createCopilotProvider({
  model: "gpt-4.1",
  cliUrl: "http://localhost:4321",  // optional
});

// Ollama
const provider = createOllamaProvider({
  model: "llama3.1:8b",
  baseUrl: "http://localhost:11434",  // optional
});
```

### 步驟 3: 更新 createCradleAssistant 呼叫

將 `model` 參數改成 `provider`:

```js
const assistant = await createCradleAssistant({
  provider,  // 取代原本的 model
  logDir: "./logs",
  cellId: "cell-001",
  cellName: "Seed Cell",
  onDelta,
  onError,
});
```

---

## 常見使用情境

### 情境 1: CradleCell 的 prepare() 方法

#### Before (舊)

```js
async prepare() {
  // ...
  
  this.assistant = await createCradleAssistant({
    model: this.model,  // ❌
    onDelta: writeAssistantChunk,
    onError: renderError,
    logDir: this.logsDir,
    cellId: this.id,
    cellName: this.name,
  });
}
```

#### After (新)

```js
import { createCopilotProvider } from "./providers/copilot-provider.js";

async prepare() {
  // ...
  
  const provider = await createCopilotProvider({
    model: this.model,  // ✅
  });
  
  this.assistant = await createCradleAssistant({
    provider,  // ✅
    onDelta: writeAssistantChunk,
    onError: renderError,
    logDir: this.logsDir,
    cellId: this.id,
    cellName: this.name,
  });
}
```

### 情境 2: 獨立使用 Cradle Assistant

#### Before (舊)

```js
import { createCradleAssistant } from "./cradle-ai.js";

const assistant = await createCradleAssistant({
  model: "gpt-4.1",  // ❌
  logDir: "./logs",
  cellId: "test",
  cellName: "Test",
});
```

#### After (新)

```js
import { createCradleAssistant } from "./cradle-ai.js";
import { createCopilotProvider } from "./providers/copilot-provider.js";

const provider = await createCopilotProvider({
  model: "gpt-4.1",
});

const assistant = await createCradleAssistant({
  provider,  // ✅
  logDir: "./logs",
  cellId: "test",
  cellName: "Test",
});
```

### 情境 3: 切換不同的 LLM

使用新架構可以輕鬆切換不同的 LLM:

```js
// 選項 1: 使用 Copilot
const provider = await createCopilotProvider({
  model: "gpt-4.1",
});

// 選項 2: 使用 Ollama
const provider = createOllamaProvider({
  model: "llama3.1:8b",
});

// 選項 3: 根據環境變數選擇
const provider = process.env.USE_OLLAMA
  ? createOllamaProvider({ model: "llama3.1:8b" })
  : await createCopilotProvider({ model: "gpt-4.1" });

// 之後的程式碼完全相同
const assistant = await createCradleAssistant({
  provider,
  // ...
});
```

---

## 相容性檢查清單

- [ ] 已匯入適當的 provider (copilot 或 ollama)
- [ ] 已在 `createCradleAssistant` 之前建立 provider
- [ ] 已將 `model` 參數改為 `provider` 參數
- [ ] 所有 `createCradleAssistant` 的呼叫都已更新
- [ ] 測試所有功能是否正常運作

---

## 回應格式變更

### 舊架構回應

```js
{
  answer: string,
  usedSkill: string | null,
  skillMissing: string | null,
  sessionFile: string,
}
```

### 新架構回應

```js
{
  answer: string,
  usedSkill: string | null,
  skillMissing: string | null,
  sessionFile: string,
  provider: string,  // ✅ 新增
  model: string,     // ✅ 新增
}
```

---

## 錯誤處理

### Provider 連線失敗

#### Copilot

```js
try {
  const provider = await createCopilotProvider({
    model: "gpt-4.1",
  });
} catch (error) {
  console.error("Copilot 連線失敗:", error.message);
  // 提示: 確保 Copilot CLI 正在運行
}
```

#### Ollama

```js
try {
  const provider = createOllamaProvider({
    model: "llama3.1:8b",
  });
  
  await assistant.ask("test");
} catch (error) {
  console.error("Ollama 連線失敗:", error.message);
  // 提示: 確保 Ollama 服務正在運行 (ollama serve)
}
```

---

## 測試遷移結果

### 1. 執行單元測試

```bash
node test/test-provider.js
```

### 2. 執行範例程式

```bash
node examples/provider-example.js --copilot
```

### 3. 測試既有功能

確認以下功能正常:
- ✅ 基本提問
- ✅ Skill 載入 (`/dna`, `/vision` 等)
- ✅ Session logging
- ✅ Streaming 回應
- ✅ 錯誤處理
- ✅ Cleanup

---

## 常見問題 (FAQ)

### Q: 為什麼要重構?

A: 為了讓 LLM 成為可替換的「能源」,而不是 Cradle 的核心依賴。這樣可以:
- 支援多種 LLM (Copilot, Ollama, OpenAI, ...)
- 更容易測試和維護
- 保持 Cradle 核心邏輯的獨立性

### Q: 舊程式碼還能用嗎?

A: 不行,`model` 參數已被移除。必須使用 `provider` 參數。

### Q: 如何新增其他 LLM?

A: 實作 Provider 介面並放在 `src/providers/` 目錄。參考 `copilot-provider.js` 或 `ollama-provider.js` 的實作。

### Q: Provider 可以動態切換嗎?

A: 可以,只需要建立新的 provider 並傳給 `createCradleAssistant` 即可。

### Q: 效能有影響嗎?

A: 沒有,抽象層的額外開銷非常小,不會影響效能。

---

## 需要協助?

參考以下文件:
- [LLM Provider 架構文件](./llm-provider.md)
- [Provider 重構說明](./PROVIDER_REFACTOR.md)
- [測試範例](../test/test-provider.js)
- [使用範例](../examples/provider-example.js)

或查看現有的實作:
- [cradle-ai.js](../src/cradle-ai.js)
- [cradle-cell.js](../src/cradle-cell.js)
- [copilot-provider.js](../src/providers/copilot-provider.js)
- [ollama-provider.js](../src/providers/ollama-provider.js)
