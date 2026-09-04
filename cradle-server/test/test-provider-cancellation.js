import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCodexProvider } from "../src/providers/codex-provider.js";
import { createCopilotProvider } from "../src/providers/copilot-provider.js";
import { createGeminiProvider } from "../src/providers/gemini-provider.js";
import { createOllamaProvider } from "../src/providers/ollama-provider.js";

const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-provider-cancel-"));
const hangingCommand = path.join(tempDirectory, "hanging-provider");

try {
  await fs.writeFile(hangingCommand, `#!/usr/bin/env node
process.on("SIGTERM", () => {});
setInterval(() => {}, 1000);
`);
  await fs.chmod(hangingCommand, 0o700);

  const codex = await createCodexProvider({ command: hangingCommand, timeoutMs: 20 });
  await assert.rejects(
    codex.ask({ prompt: "hang" }),
    /timed out after 20 ms/,
  );

  const gemini = await createGeminiProvider({ command: hangingCommand, timeoutMs: 20 });
  await assert.rejects(
    gemini.ask({ prompt: "hang" }),
    /timed out after 20 ms/,
  );

  let requestAborted = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => await new Promise((_, reject) => {
    const pendingRequest = setInterval(() => {}, 1_000);
    options.signal.addEventListener("abort", () => {
      clearInterval(pendingRequest);
      requestAborted = true;
      reject(options.signal.reason);
    }, { once: true });
  });
  try {
    const ollama = createOllamaProvider({
      baseUrl: "http://ollama.test",
      timeoutMs: 20,
    });
    await assert.rejects(ollama.ask({ prompt: "hang" }), /timed out after 20 ms/);
    assert.equal(requestAborted, true, "Ollama timeout must abort the HTTP request");
  } finally {
    globalThis.fetch = originalFetch;
  }

  let disposed = 0;
  let pendingCopilotRequest = null;
  const listeners = new Map();
  const session = {
    on(name, listener) { listeners.set(name, listener); },
    off(name) { listeners.delete(name); },
    sendAndWait() {
      pendingCopilotRequest = setInterval(() => {}, 1_000);
      return new Promise(() => {});
    },
    async disconnect() {
      clearInterval(pendingCopilotRequest);
      disposed += 1;
    },
  };
  const copilot = await createCopilotProvider({
    timeoutMs: 20,
    clientFactory: () => ({
      async createSession() { return session; },
      async stop() {},
    }),
  });
  await assert.rejects(copilot.ask({ prompt: "hang" }), /timed out after 20 ms/);
  assert.equal(disposed, 1, "Copilot timeout must dispose the active session");
  assert.equal(listeners.size, 0, "Copilot timeout must remove session listeners");
} finally {
  await fs.rm(tempDirectory, { recursive: true, force: true });
}

console.log("Provider cancellation tests passed");
