import { createCopilotProvider } from "./copilot-provider.js";
import { createOllamaProvider } from "./ollama-provider.js";
import { createGeminiProvider } from "./gemini-provider.js";
import { createCodexProvider } from "./codex-provider.js";

export async function createLLMProvider({
  provider,
  model,
  cwd = process.cwd(),
} = {}) {
  switch (provider) {
    case "ollama":
      return createOllamaProvider({
        model,
      });

    case "copilot":
      return await createCopilotProvider({
        model,
      });

    case "gemini":
      return await createGeminiProvider({
        model,
        cwd,
      });

    case "codex":
      return createCodexProvider({
        model,
        cwd,
      });

    default:
      throw new Error(
        `Unsupported LLM provider: ${provider}`
      );
  }
}