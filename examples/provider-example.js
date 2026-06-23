#!/usr/bin/env node

/**
 * Cradle LLM Provider 使用範例
 * 
 * 這個範例展示如何使用不同的 LLM Provider
 */

import { createCradleAssistant } from "../src/cradle-ai.js";
import { createCopilotProvider } from "../src/providers/copilot-provider.js";
import { createOllamaProvider } from "../src/providers/ollama-provider.js";
import path from "path";

// ================================
// 範例 1: 使用 Copilot Provider
// ================================

async function exampleCopilot() {
  console.log("📘 範例 1: 使用 Copilot Provider\n");

  // 1. 建立 Copilot Provider
  const provider = await createCopilotProvider({
    model: "gpt-4.1",
  });

  console.log(`Provider: ${provider.name}`);
  console.log(`Model: ${provider.model}\n`);

  // 2. 建立 Cradle Assistant
  const assistant = await createCradleAssistant({
    provider,
    logDir: path.join(process.cwd(), "test", "logs"),
    cellId: "example-cell",
    cellName: "Example Cell",
    onDelta: (chunk) => process.stdout.write(chunk),
    onError: (error) => console.error("Error:", error),
  });

  // 3. 提問
  console.log("Question: 什麼是 Cradle Platform?\n");
  console.log("Answer: ");
  
  const result = await assistant.ask("用一句話解釋什麼是 Cradle Platform");

  console.log("\n");
  console.log(`Session: ${result.sessionFile}`);

  // 4. 清理資源
  await assistant.cleanup();
}

// ================================
// 範例 2: 使用 Ollama Provider
// ================================

async function exampleOllama() {
  console.log("\n" + "=".repeat(50) + "\n");
  console.log("📗 範例 2: 使用 Ollama Provider\n");

  // 1. 建立 Ollama Provider
  const provider = createOllamaProvider({
    model: "llama3.1:8b",
    baseUrl: "http://localhost:11434",
  });

  console.log(`Provider: ${provider.name}`);
  console.log(`Model: ${provider.model}\n`);

  // 2. 建立 Cradle Assistant
  const assistant = await createCradleAssistant({
    provider,
    logDir: path.join(process.cwd(), "test", "logs"),
    cellId: "example-cell-ollama",
    cellName: "Example Cell (Ollama)",
    onDelta: (chunk) => process.stdout.write(chunk),
    onError: (error) => console.error("Error:", error),
  });

  // 3. 提問
  console.log("Question: 什麼是 DNA Driven Design?\n");
  console.log("Answer: ");
  
  const result = await assistant.ask("用一句話解釋什麼是 DNA Driven Design");

  console.log("\n");
  console.log(`Session: ${result.sessionFile}`);

  // 4. 清理資源
  await assistant.cleanup();
}

// ================================
// 範例 3: 使用 Skill
// ================================

async function exampleSkill() {
  console.log("\n" + "=".repeat(50) + "\n");
  console.log("📙 範例 3: 使用 Skill\n");

  const provider = await createCopilotProvider({
    model: "gpt-4.1",
  });

  const assistant = await createCradleAssistant({
    provider,
    logDir: path.join(process.cwd(), "test", "logs"),
    cellId: "example-cell-skill",
    cellName: "Example Cell (Skill)",
    onDelta: (chunk) => process.stdout.write(chunk),
    onError: (error) => console.error("Error:", error),
  });

  // 使用 Skill 指令
  console.log("Command: /dna 分析目前成熟度\n");
  console.log("Answer: ");
  
  const result = await assistant.ask("/dna 分析目前成熟度");

  console.log("\n");
  
  if (result.usedSkill) {
    console.log(`✅ Used Skill: ${result.usedSkill}`);
  } else if (result.skillMissing) {
    console.log(`⚠️  Skill Not Found: ${result.skillMissing}`);
  }

  console.log(`Session: ${result.sessionFile}`);

  await assistant.cleanup();
}

// ================================
// 主程式
// ================================

async function main() {
  const args = process.argv.slice(2);

  console.log("🚀 Cradle LLM Provider 使用範例\n");
  console.log("=".repeat(50) + "\n");

  try {
    if (args.includes("--copilot")) {
      await exampleCopilot();
    } else if (args.includes("--ollama")) {
      await exampleOllama();
    } else if (args.includes("--skill")) {
      await exampleSkill();
    } else {
      console.log("請選擇一個範例:\n");
      console.log("  --copilot  使用 Copilot Provider");
      console.log("  --ollama   使用 Ollama Provider");
      console.log("  --skill    使用 Skill 功能\n");
      console.log("範例:");
      console.log("  node examples/provider-example.js --copilot");
      console.log("  node examples/provider-example.js --ollama");
      console.log("  node examples/provider-example.js --skill\n");
    }
  } catch (error) {
    console.error("\n❌ 錯誤:", error.message);
    
    if (error.message.includes("ECONNREFUSED")) {
      console.log("\n💡 提示: 請確保相應的服務正在運行");
      console.log("  Copilot: 需要 Copilot CLI");
      console.log("  Ollama: 需要執行 'ollama serve'");
    }
    
    process.exit(1);
  }
}

main();
