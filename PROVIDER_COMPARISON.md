# Provider Streaming 對比分析

**更新日期**: 2026-07-09

---

## 📊 Copilot vs Ollama Provider

### 核心差異

| 項目 | Copilot Provider | Ollama Provider |
|------|------------------|-----------------|
| **通訊機制** | Event Listener (SDK) | HTTP Streaming (Fetch API) |
| **Session 管理** | 共享 session | 每次獨立 HTTP request |
| **Event 類型** | `assistant.message_delta` | NDJSON line-by-line |
| **Delta/Snapshot** | 純 Delta | 純 Delta |
| **Listener Cleanup** | **必須** (finally block) | **不需要** (自動關閉) |
| **主要風險** | ⚠️ Listener 累積 | ✅ 無累積風險 |

---

## 🔍 Ollama Provider 分析

### ✅ 原本就正確的部分

1. **Buffer 管理**
   ```javascript
   async ask({ prompt, onDelta }) {
     let buffer = "";  // ✅ Local variable
     // ...
   }
   ```

2. **Streaming 處理**
   ```javascript
   const reader = response.body.getReader();
   while (true) {
     const { done, value } = await reader.read();
     if (done) break;
     // ✅ 每次 read 都是新的 delta
   }
   ```

3. **Delta Append**
   ```javascript
   buffer += text;  // ✅ 正確,因為 Ollama 只發 delta
   ```

### ⚠️ 原本缺少的防護

1. **Corrupted Response 偵測**
   - 雖然理論上不會發生,但加入偵測更安全
   
2. **Debug Logging**
   - 沒有 askId 追蹤
   - 沒有 chunk count 統計
   - 錯誤訊息不夠詳細

3. **錯誤處理**
   - HTTP error 沒有包含 response body
   - Parse error 的 log 不夠清楚

---

## 🔧 修正內容

### 1. 加入 Corrupted Response 偵測

**與 Copilot Provider 使用相同的函式:**

```javascript
function looksLikeDuplicatedStream(text = "") {
  const patterns = [
    "typetype",
    "titletitle",
    "goalgoal",
    // ...
  ];
  return patterns.some((pattern) => text.includes(pattern));
}
```

### 2. 加入 Debug Logging

```javascript
const askId = crypto.randomUUID().substring(0, 8);
let chunkCount = 0;

const DEBUG = process.env.OLLAMA_DEBUG === "true";

if (DEBUG) {
  console.log(`[ollama-provider] askId=${askId} start`);
}

// 每 10 個 chunk 記錄一次
if (DEBUG && chunkCount % 10 === 0) {
  console.log(
    `[ollama-provider] askId=${askId} chunk#${chunkCount} buffer=${buffer.length}`
  );
}
```

開啟方式:
```bash
OLLAMA_DEBUG=true PROVIDER=ollama MODEL=llama3.1:8b node cradle.js
```

### 3. 改進錯誤處理

**HTTP Error:**
```javascript
if (!response.ok) {
  const errorText = await response.text();
  throw new Error(
    `Ollama request failed: ${response.status} ${errorText}`
  );
}
```

**Parse Error:**
```javascript
if (DEBUG) {
  console.warn(
    `[ollama-provider] askId=${askId} failed to parse line:`,
    line
  );
}
```

### 4. 完成後檢查

```javascript
// 檢測 corrupted response
if (looksLikeDuplicatedStream(buffer)) {
  throw new Error("Provider raw response corrupted");
}

if (DEBUG) {
  console.log(
    `[ollama-provider] askId=${askId} complete | chunks=${chunkCount} buffer=${buffer.length}`
  );
}
```

---

## 🎯 為什麼 Ollama 不需要 Listener Cleanup?

### Copilot Provider (Event Listener)
```javascript
// ⚠️ 需要 cleanup
session.on("assistant.message_delta", handleDelta);

try {
  await session.sendAndWait({ prompt });
} finally {
  session.off("assistant.message_delta", handleDelta);  // 必須
}
```

### Ollama Provider (HTTP Streaming)
```javascript
// ✅ 自動清理
const response = await fetch(url, { ... });
const reader = response.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;  // ✅ 離開後自動釋放
}
// ✅ reader 自動關閉,沒有 listener 殘留
```

**原因:**
1. HTTP streaming 是 **一次性的 connection**
2. `reader.read()` 結束後,connection 自動關閉
3. 沒有 **persistent listener** 需要清理
4. 每次 `ask()` 都是新的 HTTP request

---

## 📝 測試建議

### Ollama Provider 測試

```bash
# 1. 啟動 Ollama 服務
ollama serve

# 2. 測試 Ollama Provider (Debug Mode)
OLLAMA_DEBUG=true PROVIDER=ollama MODEL=llama3.1:8b node cradle.js

# 3. 執行測試
/use cell-001
/produce executable-java 寫一個 Java class HelloService
```

### 驗證項目

- [ ] Debug log 正常輸出
- [ ] 顯示 askId、chunk count、buffer length
- [ ] 沒有 corrupted patterns
- [ ] 錯誤訊息清楚

---

## 🎯 結論

### Copilot Provider
- **原本**: ⚠️ 有 listener 累積風險
- **修正後**: ✅ 完全穩定
- **關鍵**: Listener cleanup + Delta/Snapshot 判斷

### Ollama Provider
- **原本**: ✅ 架構正確,無累積風險
- **修正後**: ✅ 加入防護機制,更穩健
- **關鍵**: Debug visibility + Corrupted detection

### 共同點

兩個 provider 現在都有:
1. ✅ Corrupted response 偵測
2. ✅ Debug logging (askId + metrics)
3. ✅ 清楚的錯誤訊息
4. ✅ 統一的防護機制

---

**修正文件**:
- `src/providers/copilot-provider.js` - 核心修正
- `src/providers/ollama-provider.js` - 防護加強

**環境變數**:
- `COPILOT_DEBUG=true` - Copilot debug mode
- `OLLAMA_DEBUG=true` - Ollama debug mode
