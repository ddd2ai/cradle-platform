import { CopilotClient } from "@github/copilot-sdk";

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
      let buffer = "";

      const handleDelta = (event) => {
        const chunk = event.data.deltaContent || "";
        buffer += chunk;
        onDelta?.(chunk);
      };

      const handleIdle = () => {
        onIdle?.();
      };

      const handleError = (error) => {
        onError?.(error);
      };

      session.on("assistant.message_delta", handleDelta);
      session.on("session.idle", handleIdle);
      session.on("error", handleError);

      try {
        await session.sendAndWait({ prompt });
        return buffer;
      } catch (error) {
        handleError(error);
        throw error;
      }
    },

    async cleanup() {
      await session.disconnect?.();
      await client.stop?.();
    },
  };
}
