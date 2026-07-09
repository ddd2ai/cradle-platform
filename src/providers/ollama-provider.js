import crypto from "crypto";

/**
 * 偵測 corrupted raw response (duplicated streaming chunks)
 */
function looksLikeDuplicatedStream(text = "") {
  const patterns = [
    "typetype",
    "titletitle",
    "goalgoal",
    "outputsoutputs",
    "contentcontent",
    "LibraryLibrary",
    "accepted accepted",
    "{{",
    '" "',
  ];

  return patterns.some((pattern) => text.includes(pattern));
}

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
      const askId = crypto.randomUUID().substring(0, 8);
      let buffer = "";
      let chunkCount = 0;

      const DEBUG = process.env.OLLAMA_DEBUG === "true";

      if (DEBUG) {
        console.log(`[ollama-provider] askId=${askId} start`);
      }

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
          const errorText = await response.text();
          throw new Error(
            `Ollama request failed: ${response.status} ${errorText}`
          );
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

              if (text.length > 0) {
                chunkCount++;
                buffer += text;
                onDelta?.(text);

                if (DEBUG && chunkCount % 10 === 0) {
                  console.log(
                    `[ollama-provider] askId=${askId} chunk#${chunkCount} buffer=${buffer.length}`
                  );
                }
              }
            } catch (parseError) {
              // 跳過無法解析的行
              if (DEBUG) {
                console.warn(
                  `[ollama-provider] askId=${askId} failed to parse line:`,
                  line
                );
              }
            }
          }
        }

        // 檢測 corrupted response
        if (looksLikeDuplicatedStream(buffer)) {
          const preview = buffer.substring(0, 300);
          throw new Error(
            `Provider raw response appears corrupted by duplicated streaming chunks. Check ollama-provider streaming handling.\n\nPreview:\n${preview}`
          );
        }

        if (DEBUG) {
          console.log(
            `[ollama-provider] askId=${askId} complete | chunks=${chunkCount} buffer=${buffer.length} chars`
          );
          console.log(
            `[ollama-provider] raw response preview:\n${buffer.substring(0, 300)}`
          );
        }

        onIdle?.();
        return buffer;
      } catch (error) {
        if (DEBUG) {
          console.error(`[ollama-provider] askId=${askId} error:`, error);
        }
        onError?.(error);
        throw error;
      }
    },

    async cleanup() {
      // Ollama HTTP 模式通常不需要 cleanup
    },
  };
}
