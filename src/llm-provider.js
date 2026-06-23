/**
 * LLM Provider Interface
 *
 * Cradle Platform 的 LLM Provider 是 Cradle Cell 的「感知器官」。
 * 它定義了 Cradle 如何與各種 LLM 模型互動,讓模型成為可替換的能源。
 *
 * @typedef {Object} LLMProvider
 * @property {string} name - Provider 名稱 (e.g., "copilot", "ollama")
 * @property {string} model - 使用的模型名稱 (e.g., "gpt-4.1", "llama3.1:8b")
 * @property {Function} ask - 向 LLM 提問並取得回應
 * @property {Function} [cleanup] - 清理資源 (optional)
 */

/**
 * Ask 函式的參數
 *
 * @typedef {Object} AskOptions
 * @property {string} prompt - 完整的 prompt,包含 system prompt 和 user input
 * @property {Function} [onDelta] - 每次收到新內容時的回調 (chunk: string) => void
 * @property {Function} [onIdle] - 回應完成時的回調 () => void
 * @property {Function} [onError] - 發生錯誤時的回調 (error: Error) => void
 */

/**
 * Provider.ask() 的回傳值
 *
 * @typedef {string} AskResponse - 完整的回應內容
 */

/**
 * 建立 LLM Provider 的工廠函式範例
 *
 * @example
 * export async function createMyProvider({ model, apiKey }) {
 *   // 初始化連線
 *   const connection = await connect({ model, apiKey });
 *
 *   return {
 *     name: "my-provider",
 *     model,
 *
 *     async ask({ prompt, onDelta, onIdle, onError }) {
 *       let buffer = "";
 *
 *       try {
 *         // 發送請求並處理 streaming
 *         for await (const chunk of connection.stream(prompt)) {
 *           buffer += chunk;
 *           onDelta?.(chunk);
 *         }
 *
 *         onIdle?.();
 *         return buffer;
 *       } catch (error) {
 *         onError?.(error);
 *         throw error;
 *       }
 *     },
 *
 *     async cleanup() {
 *       await connection.close();
 *     }
 *   };
 * }
 */

/**
 * Provider 介面規格
 *
 * 所有 LLM Provider 都必須實作以下介面:
 *
 * 1. 屬性:
 *    - name: string (provider 名稱)
 *    - model: string (模型名稱)
 *
 * 2. 方法:
 *    - ask(options: AskOptions): Promise<string>
 *      接收 prompt 並回傳完整回應,支援 streaming
 *
 *    - cleanup(): Promise<void> (optional)
 *      清理資源,例如關閉連線、釋放 session
 *
 * 3. Streaming 行為:
 *    - Provider 應該在收到內容時即時呼叫 onDelta(chunk)
 *    - 完成時呼叫 onIdle()
 *    - 錯誤時呼叫 onError(error)
 *    - ask() 最終應回傳完整內容
 *
 * 4. 錯誤處理:
 *    - 發生錯誤時應呼叫 onError 並拋出 error
 *    - Cradle 會負責記錄錯誤並處理
 */

export const LLMProviderInterface = {
  name: "interface-definition",
  model: "N/A",

  async ask({ prompt, onDelta, onIdle, onError }) {
    throw new Error("LLMProviderInterface.ask() must be implemented");
  },

  async cleanup() {
    // Optional: 清理資源
  },
};
