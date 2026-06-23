#!/usr/bin/env node

/**
 * Test script for Cradle LLM Provider architecture
 *
 * Usage:
 *   node test/test-provider.js
 */

import { createCradleAssistant } from "../src/cradle-ai.js";
import { createCopilotProvider } from "../src/providers/copilot-provider.js";
import { createOllamaProvider } from "../src/providers/ollama-provider.js";
import path from "path";

async function testCopilotProvider() {
  console.log("🧪 Testing Copilot Provider...\n");

  try {
    const provider = await createCopilotProvider({
      model: "gpt-5-mini",
    });

    console.log(`✅ Provider created: ${provider.name}`);
    console.log(`✅ Model: ${provider.model}\n`);

    const assistant = await createCradleAssistant({
      provider,
      logDir: path.join(process.cwd(), "test", "logs"),
      cellId: "test-cell",
      cellName: "Test Cell",
      onDelta: (chunk) => process.stdout.write(chunk),
      onError: (error) => console.error("❌ Error:", error),
    });

    console.log("🤖 Assistant created\n");
    console.log("📝 Asking question...\n");

    const result = await assistant.ask("用一句話解釋什麼是 Cradle Platform");

    console.log("\n");
    console.log("✅ Response received");
    console.log(`📄 Session log: ${result.sessionFile}`);
    console.log(`🔧 Provider: ${result.provider}`);
    console.log(`🤖 Model: ${result.model}`);

    await assistant.cleanup();
    console.log("\n✅ Cleanup completed");

    return true;
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    return false;
  }
}

async function testOllamaProvider() {
  console.log("\n🧪 Testing Ollama Provider...\n");

  try {
    const provider = createOllamaProvider({
      model: "llama3.1:8b",
    });

    console.log(`✅ Provider created: ${provider.name}`);
    console.log(`✅ Model: ${provider.model}\n`);

    const assistant = await createCradleAssistant({
      provider,
      logDir: path.join(process.cwd(), "test", "logs"),
      cellId: "test-cell-ollama",
      cellName: "Test Cell (Ollama)",
      onDelta: (chunk) => process.stdout.write(chunk),
      onError: (error) => console.error("❌ Error:", error),
    });

    console.log("🤖 Assistant created\n");
    console.log("📝 Asking question...\n");

    const result = await assistant.ask("用一句話解釋什麼是 DNA Driven Design");

    console.log("\n");
    console.log("✅ Response received");
    console.log(`📄 Session log: ${result.sessionFile}`);
    console.log(`🔧 Provider: ${result.provider}`);
    console.log(`🤖 Model: ${result.model}`);

    await assistant.cleanup();
    console.log("\n✅ Cleanup completed");

    return true;
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.log("💡 Make sure Ollama is running: ollama serve");
    return false;
  }
}

async function main() {
  console.log("🚀 Cradle LLM Provider Test Suite\n");
  console.log("=".repeat(50));
  console.log();

  const copilotSuccess = await testCopilotProvider();

  console.log("\n" + "=".repeat(50));

  // Ollama test is optional
  const testOllama = process.argv.includes("--ollama");

  if (testOllama) {
    const ollamaSuccess = await testOllamaProvider();
    console.log("\n" + "=".repeat(50));
    console.log("\n🏁 Test Summary:");
    console.log(`  Copilot: ${copilotSuccess ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`  Ollama:  ${ollamaSuccess ? "✅ PASS" : "❌ FAIL"}`);
  } else {
    console.log("\n🏁 Test Summary:");
    console.log(`  Copilot: ${copilotSuccess ? "✅ PASS" : "❌ FAIL"}`);
    console.log("\n💡 Run with --ollama to test Ollama provider");
  }

  console.log();
  process.exit(copilotSuccess ? 0 : 1);
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
