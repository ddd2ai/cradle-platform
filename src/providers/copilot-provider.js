import { CopilotClient } from "@github/copilot-sdk";
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
 * 從 event 萃取文字內容
 * 自動判斷是 delta 還是 snapshot
 */
function extractTextEvent(event) {
  return {
    // Delta: 新增的內容片段
    delta:
      event.deltaContent ??
      event.data?.deltaContent ??
      event.delta ??
      event.data?.delta ??
      null,

    // Snapshot: 目前累積的完整內容
    snapshot:
      event.content ??
      event.text ??
      event.data?.content ??
      event.data?.text ??
      null,
  };
}

/**
 * Copilot Provider
 *
 * 使用 GitHub Copilot SDK 作為 LLM 來源。
 * 透過 Copilot CLI 連線到 GitHub Copilot 服務。
 *
 * @param {Object} options
 * @param {string} [options.model="gpt-5-mini"] - 使用的模型
 * @param {string} [options.cliUrl="http://localhost:4321"] - Copilot CLI URL
 * @returns {Promise<LLMProvider>}
 *
 * @example
 * const provider = await createCopilotProvider({
 *   model: "gpt-5-mini",
 * });
 *
 * const response = await provider.ask({
 *   prompt: "Hello, world!",
 *   onDelta: (chunk) => console.log(chunk),
 * });
 */
export async function createCopilotProvider({
  model = "gpt-5-mini",
  cliUrl = "http://localhost:4321",
}) {
  const client = new CopilotClient({
    cliUrl,
  });

  const approveAll = async () => ({ outcome: "approved" });

  const session = await client.createSession({
    model,
    streaming: true,
    onPermissionRequest: approveAll,
  });

  return {
    name: "copilot",
    model,

    async ask({ prompt, onDelta, onIdle, onError }) {
      const askId = crypto.randomUUID().substring(0, 8);
      let buffer = "";
      let lastBufferLength = 0;
      let eventCount = 0;
      let deltaCount = 0;
      let snapshotCount = 0;

      const DEBUG = process.env.COPILOT_DEBUG === "true";

      if (DEBUG) {
        console.log(`[copilot-provider] askId=${askId} start`);
      }

      const handleDelta = (event) => {
        eventCount++;

        const { delta, snapshot } = extractTextEvent(event);

        // 優先處理 delta (新增內容)
        if (typeof delta === "string" && delta.length > 0) {
          deltaCount++;
          buffer += delta;

          if (DEBUG) {
            console.log(
              `[copilot-provider] askId=${askId} event#${eventCount} DELTA len=${delta.length} buffer=${buffer.length}`
            );
            console.log(
              `[copilot-provider] delta preview: ${delta.substring(0, 100)}`
            );
          }

          onDelta?.(delta);
          lastBufferLength = buffer.length;
          return;
        }

        // 處理 snapshot (完整內容)
        if (typeof snapshot === "string" && snapshot.length > 0) {
          snapshotCount++;
          
          // CRITICAL: snapshot 要 replace,不是 append
          buffer = snapshot;

          if (DEBUG) {
            console.log(
              `[copilot-provider] askId=${askId} event#${eventCount} SNAPSHOT len=${snapshot.length} buffer=${buffer.length}`
            );
          }

          // 只通知新增的部分
          const newContent = buffer.substring(lastBufferLength);
          if (newContent.length > 0) {
            onDelta?.(newContent);
          }

          lastBufferLength = buffer.length;
          return;
        }

        // 未知的 event 格式
        if (DEBUG) {
          console.warn(
            `[copilot-provider] askId=${askId} event#${eventCount} UNKNOWN format`,
            event
          );
        }
      };

      const handleIdle = () => {
        if (DEBUG) {
          console.log(
            `[copilot-provider] askId=${askId} idle | events=${eventCount} deltas=${deltaCount} snapshots=${snapshotCount} buffer=${buffer.length}`
          );
        }
        onIdle?.();
      };

      const handleError = (error) => {
        if (DEBUG) {
          console.error(`[copilot-provider] askId=${askId} error:`, error);
        }
        onError?.(error);
      };

      session.on("assistant.message_delta", handleDelta);
      session.on("session.idle", handleIdle);
      session.on("error", handleError);

      try {
        await session.sendAndWait({ prompt });

        // 檢測 corrupted response
        if (looksLikeDuplicatedStream(buffer)) {
          const preview = buffer.substring(0, 300);
          throw new Error(
            `Provider raw response appears corrupted by duplicated streaming chunks. Check copilot-provider streaming handling.\n\nPreview:\n${preview}`
          );
        }

        if (DEBUG) {
          console.log(
            `[copilot-provider] askId=${askId} complete | buffer=${buffer.length} chars`
          );
          console.log(
            `[copilot-provider] raw response preview:\n${buffer.substring(0, 300)}`
          );
        }

        return buffer;
      } catch (error) {
        handleError(error);
        throw error;
      } finally {
        // 移除所有 listener,避免累積洩漏
        session.off?.("assistant.message_delta", handleDelta);
        session.off?.("session.idle", handleIdle);
        session.off?.("error", handleError);

        // 相容 Node EventEmitter API
        session.removeListener?.("assistant.message_delta", handleDelta);
        session.removeListener?.("session.idle", handleIdle);
        session.removeListener?.("error", handleError);

        if (DEBUG) {
          console.log(`[copilot-provider] askId=${askId} cleanup done`);
        }
      }
    },

    async cleanup() {
      await session.disconnect?.();
      await client.stop?.();
    },
  };
}
