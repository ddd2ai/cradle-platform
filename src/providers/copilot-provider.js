import { CopilotClient } from "@github/copilot-sdk";

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
    "notesnotes",
    "HelloHello",
    "LibraryLibrary",
    "SpringSpring",
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

export async function createCopilotProvider({
  model = "gpt-5-mini",
  cliUrl = "http://localhost:4321",
} = {}) {
  const client = new CopilotClient({
    cliUrl,
  });

  const approveAll = async () => ({ outcome: "approved" });

  return {
    name: "copilot",
    model,

    async ask({ prompt, onDelta, onIdle, onError } = {}) {
      let buffer = "";
      let session = null;
      let closed = false;

      const askId = `ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Step 2: 集中清理函式（只執行一次）
      const finishOnce = (reason = "complete") => {
        if (closed) return;

        closed = true;

        // 真正移除 listener（Step 3）
        if (session) {
          session.off?.("assistant.message_delta", handleDelta);
          session.off?.("session.idle", handleIdle);
          session.off?.("error", handleError);
          session.removeAllListeners?.();
        }

        // 清空 callback references，防止記憶體洩漏
        onDelta = null;
        onIdle = null;
        onError = null;
      };

      // Step 1 & 4: 加入 closed guard 和 askId 過濾
      const handleDelta = (event) => {
        if (closed) return;

        // Step 4: askId 過濾（如果 event 有提供 askId）
        if (event.askId && event.askId !== askId) {
          return;
        }

        const { delta, snapshot } = extractTextEvent(event);

        if (typeof delta === "string" && delta.length > 0) {
          buffer += delta;
          onDelta?.(delta);
          return;
        }

        if (typeof snapshot === "string" && snapshot.length > 0) {
          // snapshot 是完整內容，不可以 append
          buffer = snapshot;

          // snapshot 模式下不要直接 onDelta(snapshot)，否則畫面會重複印完整內容
          return;
        }
      };

      const handleIdle = () => {
        if (closed) return;

        onIdle?.();
      };

      const handleError = (error) => {
        if (closed) return;

        onError?.(error);
      };

      try {
        session = await client.createSession({
          model,
          streaming: true,
          onPermissionRequest: approveAll,
        });

        // Step 3: 使用 named function，方便移除
        session.on?.("assistant.message_delta", handleDelta);
        session.on?.("session.idle", handleIdle);
        session.on?.("error", handleError);

        await session.sendAndWait({ prompt });

        if (looksLikeDuplicatedStream(buffer)) {
          throw new Error(
            [
              "Provider raw response appears corrupted by duplicated streaming chunks.",
              "Check copilot-provider streaming handling.",
              "",
              "Preview:",
              buffer.slice(0, 1000),
            ].join("\n")
          );
        }

        return buffer;
      } catch (error) {
        finishOnce("error");
        onError?.(error);
        throw error;
      } finally {
        finishOnce("cleanup");

        if (session) {
          // 斷開本次 ask 的 session
          await session.disconnect?.();
          await session.close?.();
          await session.dispose?.();
        }
      }
    },

    async cleanup() {
      await client.stop?.();
    },
  };
}