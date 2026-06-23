# Cradle LLM Provider Architecture

## 概念

Cradle Platform 的 LLM Provider 是 Cradle Cell 的「感知器官」。

LLM 不是 Cradle 的核心,而是可替換的「能源」。

Cradle 透過 Provider 抽象層與各種 LLM 互動,讓 Cell 可以隨時切換不同的模型。

---

## 架構

```
cradle-ai.js
  └─ createCradleAssistant()
      只負責 Cradle 行為
      - Skill loading
      - Session logging
      - Memory context
      - Prompt building

llm-provider.js
  └─ LLM Provider 介面定義
      - name: string
      - model: string
      - ask(options): Promise<string>
      - cleanup(): Promise<void>

providers/copilot-provider.js
  └─ Copilot SDK 實作
      - GitHub Copilot CLI
      - Streaming support

providers/ollama-provider.js
  └─ Ollama 實作
      - Local Ollama HTTP API
      - Streaming support
```

---

## Provider 介面

所有 LLM Provider 都必須實作以下介面:

```js
{
  name: string,           // Provider 名稱 (e.g., "copilot", "ollama")
  model: string,          // 模型名稱 (e.g., "gpt-5-mini", "llama3.1:8b")

  async ask({
    prompt,               // 完整 prompt (system + user)
    onDelta,             // (chunk: string) => void
    onIdle,              // () => void
    onError,             // (error: Error) => void
  }): Promise<string>,   // 回傳完整回應

  async cleanup()        // 清理資源 (optional)
}
```

---

## 使用方式

### 1. 使用 Copilot Provider

```js
import { createCradleAssistant } from "./src/cradle-ai.js";
import { createCopilotProvider } from "./src/providers/copilot-provider.js";

const provider = await createCopilotProvider({
  model: "gpt-5-mini",
});

const assistant = await createCradleAssistant({
  provider,
  logDir: "./logs",
  cellId: "cell-001",
  cellName: "Seed Cell",
  onDelta: (chunk) => console.log(chunk),
  onError: (error) => console.error(error),
});

await assistant.ask("/dna 幫我分析目前成熟度");
await assistant.cleanup();
```

### 2. 使用 Ollama Provider

```js
import { createCradleAssistant } from "./src/cradle-ai.js";
import { createOllamaProvider } from "./src/providers/ollama-provider.js";

const provider = createOllamaProvider({
  model: "llama3.1:8b",
  baseUrl: "http://localhost:11434",
});

const assistant = await createCradleAssistant({
  provider,
  logDir: "./logs",
  cellId: "cell-001",
  cellName: "Seed Cell",
  onDelta: (chunk) => console.log(chunk),
  onError: (error) => console.error(error),
});

await assistant.ask("幫我思考下一步");
await assistant.cleanup();
```

### 3. 在 CradleCell 中使用

`CradleCell` 已經內建使用 Copilot Provider:

```js
import { CradleCell } from "./src/cradle-cell.js";

const cell = new CradleCell({
  id: "cell-001",
  name: "Seed Cell",
  model: "gpt-5-mini",
});

await cell.prepare();
await cell.ask("幫我分析目前的 DNA 狀態");
```

如果要切換成 Ollama,可以修改 `cradle-cell.js` 的 `prepare()` 方法:

```js
import { createOllamaProvider } from "./providers/ollama-provider.js";

async prepare() {
  // ...
  
  const provider = createOllamaProvider({
    model: "llama3.1:8b",
  });

  this.assistant = await createCradleAssistant({
    provider,
    // ...
  });
}
```

---

## 測試

執行測試腳本:

```bash
# 測試 Copilot Provider
node test/test-provider.js

# 測試 Copilot + Ollama
node test/test-provider.js --ollama
```

---

## 新增其他 Provider

如果要新增其他 LLM Provider (例如 OpenAI, Anthropic, Azure OpenAI),只需要:

1. 在 `src/providers/` 建立新的 provider 檔案
2. 實作 LLM Provider 介面
3. 在 `createCradleAssistant` 時傳入新的 provider

範例:

```js
// src/providers/openai-provider.js
export async function createOpenAIProvider({
  model = "gpt-4",
  apiKey,
}) {
  return {
    name: "openai",
    model,

    async ask({ prompt, onDelta, onIdle, onError }) {
      // 實作 OpenAI API streaming
      // ...
    },

    async cleanup() {
      // 清理資源
    },
  };
}
```

---

## 設計原則

1. **單一職責**: `cradle-ai.js` 只負責 Cradle 行為,不管 LLM 實作細節
2. **依賴反轉**: Cradle 依賴 Provider 介面,不依賴具體實作
3. **可擴展性**: 新增 Provider 不需要修改 Cradle 核心程式碼
4. **可測試性**: Provider 可以單獨測試,也可以 mock
5. **可替換性**: 隨時切換不同的 LLM 而不影響 Cradle 行為

---

## 檔案清單

```
src/
  cradle-ai.js           # Cradle Assistant 核心
  llm-provider.js        # Provider 介面定義
  providers/
    copilot-provider.js  # Copilot SDK 實作
    ollama-provider.js   # Ollama HTTP API 實作

test/
  test-provider.js       # Provider 測試腳本
```

---

## 下一步

- [ ] 新增 OpenAI Provider
- [ ] 新增 Azure OpenAI Provider
- [ ] 新增 Anthropic Provider
- [ ] 新增 Provider 切換 CLI 指令
- [ ] 新增 Provider 效能監控
- [ ] 新增 Provider fallback 機制
