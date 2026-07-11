import { CopilotClient } from "@github/copilot-sdk";

/**
 * 從 Copilot SDK event 萃取文字內容。
 *
 * delta:
 *   本次新增的內容片段，可直接 append。
 *
 * snapshot:
 *   目前累積的完整內容，應直接覆蓋 buffer，
 *   不可 append，否則會造成重複。
 */
function extractTextEvent(event = {}) {
  return {
    delta:
      event.deltaContent ??
      event.data?.deltaContent ??
      event.delta ??
      event.data?.delta ??
      null,

    snapshot:
      event.content ??
      event.text ??
      event.data?.content ??
      event.data?.text ??
      null,
  };
}

/**
 * 安全清理單次 Copilot session。
 *
 * cleanup 發生錯誤時，不應覆蓋真正的模型執行錯誤。
 */
async function disposeSession(session) {
  if (!session) {
    return;
  }

  await Promise.allSettled([
    session.disconnect?.(),
    session.close?.(),
    session.dispose?.(),
  ]);
}

export async function createCopilotProvider({
  model = "gpt-5-mini",
  cliUrl = "http://localhost:4321",
} = {}) {
  const client = new CopilotClient({
    cliUrl,
  });

  const approveAll = async () => ({
    outcome: "approved",
  });

  return {
    name: "copilot",
    model,

    async ask({
      prompt,
      onDelta,
      onIdle,
      onError,
    } = {}) {
      if (
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        const error = new Error(
          "CopilotProvider.ask() requires a non-empty prompt"
        );

        onError?.(error);
        throw error;
      }

      let session = null;
      let buffer = "";
      let finished = false;
      let idleNotified = false;

      const notifyIdleOnce = () => {
        if (idleNotified) {
          return;
        }

        idleNotified = true;
        onIdle?.();
      };

      const handleDelta = (event) => {
        if (finished) {
          return;
        }

        const {
          delta,
          snapshot,
        } = extractTextEvent(event);

        if (
          typeof delta === "string" &&
          delta.length > 0
        ) {
          buffer += delta;
          onDelta?.(delta);
          return;
        }

        if (
          typeof snapshot === "string" &&
          snapshot.length > 0
        ) {
          /*
           * Snapshot 是目前完整內容。
           * 只能覆蓋，不可以 append。
           *
           * 這裡不呼叫 onDelta(snapshot)，
           * 避免畫面反覆印出完整內容。
           */
          buffer = snapshot;
        }
      };

      const handleIdle = () => {
        if (finished) {
          return;
        }

        notifyIdleOnce();
      };

      const handleError = (error) => {
        if (finished) {
          return;
        }

        onError?.(error);
      };

      const removeListeners = () => {
        if (!session) {
          return;
        }

        session.off?.(
          "assistant.message_delta",
          handleDelta
        );

        session.off?.(
          "session.idle",
          handleIdle
        );

        session.off?.(
          "error",
          handleError
        );
      };

      try {
        session = await client.createSession({
          model,
          streaming: true,
          onPermissionRequest: approveAll,
        });

        session.on?.(
          "assistant.message_delta",
          handleDelta
        );

        session.on?.(
          "session.idle",
          handleIdle
        );

        session.on?.(
          "error",
          handleError
        );

        await session.sendAndWait({
          prompt,
        });

        if (!buffer.trim()) {
          throw new Error(
            "Copilot returned an empty response"
          );
        }

        notifyIdleOnce();

        return buffer;
      } catch (error) {
        onError?.(error);
        throw error;
      } finally {
        finished = true;

        removeListeners();

        onDelta = null;
        onIdle = null;
        onError = null;

        await disposeSession(session);
      }
    },

    async cleanup() {
      await client.stop?.();
    },
  };
}