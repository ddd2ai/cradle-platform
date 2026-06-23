/**
 * Ollama Provider
 *
 * 使用 Ollama HTTP API 作為 LLM 來源。
 * 支援本地運行的 Ollama 服務。
 *
 * @param {Object} options
 * @param {string} [options.model="llama3.1:8b"] - 使用的模型
 * @param {string} [options.baseUrl="http://localhost:11434"] - Ollama API URL
 * @returns {LLMProvider}
 *
 * @example
 * const provider = createOllamaProvider({
 *   model: "llama3.1:8b",
 * });
 *
 * const response = await provider.ask({
 *   prompt: "Hello, world!",
 *   onDelta: (chunk) => console.log(chunk),
 * });
 */
export function createOllamaProvider({
  model = "llama3.1:8b",
  baseUrl = "http://localhost:11434",
}) {
  return {
    name: "ollama",
    model,

    async ask({ prompt, onDelta, onIdle, onError }) {
      let buffer = "";

      try {
        const response = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            prompt,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter(Boolean);

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              const text = data.response || "";

              buffer += text;
              onDelta?.(text);
            } catch (parseError) {
              // 跳過無法解析的行
              console.warn("Failed to parse Ollama response line:", line);
            }
          }
        }

        onIdle?.();
        return buffer;
      } catch (error) {
        onError?.(error);
        throw error;
      }
    },

    async cleanup() {
      // Ollama HTTP 模式通常不需要 cleanup
    },
  };
}
