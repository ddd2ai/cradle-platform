# LLM Provider 快速參考

## 基本使用

### Copilot Provider

```js
import { createCradleAssistant } from "./src/cradle-ai.js";
import { createCopilotProvider } from "./src/providers/copilot-provider.js";

// 1. 建立 provider
const provider = await createCopilotProvider({
  model: "gpt-5-mini",
});

// 2. 建立 assistant
const assistant = await createCradleAssistant({
  provider,
  logDir: "./logs",
  cellId: "cell-001",
  cellName: "My Cell",
});

// 3. 提問
await assistant.ask("幫我分析 DNA");

// 4. 清理
await assistant.cleanup();
```

### Ollama Provider

```js
import { createOllamaProvider } from "./src/providers/ollama-provider.js";

const provider = createOllamaProvider({
  model: "llama3.1:8b",
});

// 其餘相同...
```

---

## Provider 介面

```js
{
  name: string,          // "copilot" | "ollama" | ...
  model: string,         // "gpt-5-mini" | "llama3.1:8b" | ...
  
  async ask({
    prompt: string,      // 完整 prompt
    onDelta?: (chunk: string) => void,
    onIdle?: () => void,
    onError?: (error: Error) => void,
  }): Promise<string>,
  
  async cleanup?(): Promise<void>
}
```

---

## 常用指令

```bash
# 測試 Copilot
node test/test-provider.js

# 測試 Ollama
node test/test-provider.js --ollama

# 執行範例
node examples/provider-example.js --copilot
node examples/provider-example.js --ollama
```

---

## 切換 Provider

```js
// 方法 1: 直接指定
const provider = await createCopilotProvider({ model: "gpt-5-mini" });

// 方法 2: 根據環境變數
const provider = process.env.USE_OLLAMA
  ? createOllamaProvider({ model: "llama3.1:8b" })
  : await createCopilotProvider({ model: "gpt-5-mini" });

// 方法 3: 根據配置檔
const config = require("./config.json");
const provider = config.provider === "ollama"
  ? createOllamaProvider({ model: config.model })
  : await createCopilotProvider({ model: config.model });
```

---

## Skill 使用

```js
// 使用 /dna skill
await assistant.ask("/dna 分析目前成熟度");

// 使用 /vision skill
await assistant.ask("/vision 檢視願景");

// 一般提問
await assistant.ask("幫我思考下一步");
```

---

## 回應格式

```js
{
  answer: string,           // LLM 回應內容
  usedSkill: string|null,   // 使用的 skill 名稱
  skillMissing: string|null, // 找不到的 skill 名稱
  sessionFile: string,      // session log 檔案路徑
  provider: string,         // provider 名稱
  model: string,            // 模型名稱
}
```

---

## CradleCell 整合

```js
import { CradleCell } from "./src/cradle-cell.js";

const cell = new CradleCell({
  id: "cell-001",
  name: "My Cell",
  model: "gpt-5-mini",
});

await cell.prepare();  // 自動建立 provider
await cell.ask("幫我分析 DNA");
```

---

## 新增 Provider

```js
// src/providers/my-provider.js
export async function createMyProvider({ model, apiKey }) {
  return {
    name: "my-provider",
    model,
    
    async ask({ prompt, onDelta, onIdle, onError }) {
      // 實作 LLM API 呼叫
      let buffer = "";
      
      // ... streaming logic ...
      
      return buffer;
    },
    
    async cleanup() {
      // 清理資源
    }
  };
}
```

---

## 相關文件

- [架構文件](./llm-provider.md)
- [遷移指南](./MIGRATION_GUIDE.md)
- [重構說明](./PROVIDER_REFACTOR.md)
- [總結文件](./REFACTOR_SUMMARY.md)

---

## 常見問題

### Q: Provider 連線失敗?

**Copilot**: 確保 Copilot CLI 正在運行
**Ollama**: 確保執行 `ollama serve`

### Q: 如何切換 Provider?

建立不同的 provider 並傳給 `createCradleAssistant`

### Q: 可以同時使用多個 Provider?

可以,建立多個 assistant 實例

### Q: Provider 效能差異?

取決於 LLM 本身,架構層開銷可忽略

---

**版本**: v2.0.0

**更新**: 2026-06-23
