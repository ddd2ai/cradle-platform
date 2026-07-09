import crypto from "crypto";

/**
 * 偵測 corrupted raw response (duplicated streaming chunks)
 *
 * 注意：
 * Ollama 正常不應該出現 listener 疊加。
 * 這裡只做防呆，不要太激進，避免誤判正常內容。
 */
function looksLikeDuplicatedStream(text = "") {
  const severePatterns = [
    "typetype",
    "titletitle",
    "goalgoal",
    "outputsoutputs",
    "contentcontent",
    "notesnotes",
  ];

  const matched = severePatterns.filter((pattern) => text.includes(pattern));

  // 至少出現兩種 artifact key 重複，才判定為 corrupted
  return matched.length >= 2;
}

/**
 * 處理 Ollama stream line
 */
function parseOllamaLine(line, { askId, DEBUG } = {}) {
  const trimmed = String(line ?? "").trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    if (DEBUG) {
      console.warn(
        `[ollama-provider] askId=${askId} failed to parse line:`,
        trimmed
      );
      console.warn(`[ollama-provider] parse error:`, error.message);
    }

    return null;
  }
}

/**
 * Ollama Provider
 *
 * 使用 Ollama HTTP API 作為 LLM 來源。
 * 支援本地運行的 Ollama 服務。
 */
export function createOllamaProvider({
  model = "llama3.1:8b",
  baseUrl = "http://localhost:11434",
} = {}) {
  return {
    name: "ollama",
    model,

    async ask({ prompt, onDelta, onIdle, onError } = {}) {
      const askId = crypto.randomUUID().substring(0, 8);
      const DEBUG = process.env.OLLAMA_DEBUG === "true";

      let buffer = "";
      let lineBuffer = "";
      let chunkCount = 0;

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

        if (!response.body) {
          throw new Error("Ollama response body is empty.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let modelDone = false;

        while (!modelDone) {
          const { done, value } = await reader.read();

          if (done) {
            // flush decoder
            lineBuffer += decoder.decode();
            break;
          }

          /**
           * 關鍵修正：
           * 不可以直接 chunk.split("\n") 後丟掉 parse 失敗的行。
           * 因為 HTTP stream 可能剛好把一個 JSON line 切成兩半。
           *
           * 所以要保留最後一段 incomplete line 到下一輪。
           */
          lineBuffer += decoder.decode(value, { stream: true });

          const lines = lineBuffer.split(/\r?\n/);
          lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const data = parseOllamaLine(line, { askId, DEBUG });

            if (!data) {
              continue;
            }

            if (data.error) {
              throw new Error(`Ollama model error: ${data.error}`);
            }

            const text = data.response ?? "";

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

            if (data.done === true) {
              modelDone = true;
              break;
            }
          }
        }

        /**
         * 處理最後殘留的 lineBuffer。
         * 有些環境最後一行可能沒有 newline。
         */
        const tail = lineBuffer.trim();

        if (tail.length > 0) {
          const data = parseOllamaLine(tail, { askId, DEBUG });

          if (data?.error) {
            throw new Error(`Ollama model error: ${data.error}`);
          }

          const text = data?.response ?? "";

          if (text.length > 0) {
            chunkCount++;
            buffer += text;
            onDelta?.(text);
          }
        }

        if (looksLikeDuplicatedStream(buffer)) {
          const preview = buffer.substring(0, 1000);

          throw new Error(
            [
              "Provider raw response appears corrupted by duplicated streaming chunks.",
              "This is unusual for Ollama. Check provider streaming handling or caller onDelta behavior.",
              "",
              "Preview:",
              preview,
            ].join("\n")
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