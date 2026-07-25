import assert from "node:assert/strict";

import {
  createGeminiProvider,
} from "../src/providers/gemini-provider.js";

async function main() {
  console.log("\n=== Gemini Provider Test ===\n");

  const chunks = [];

  const provider = await createGeminiProvider({
    cwd: process.cwd(),
  });

  const answer = await provider.ask({
    prompt:
      "請只回答：Gemini provider successful",

    onDelta(chunk) {
      chunks.push(chunk);
      process.stdout.write(chunk);
    },

    onIdle() {
      console.log("\n\nGemini response completed.");
    },

    onError(error) {
      console.error(
        "\nGemini provider error:",
        error.message
      );
    },
  });

  assert.equal(provider.name, "gemini-cli");
  assert.equal(typeof answer, "string");
  assert.ok(answer.length > 0);
  assert.equal(chunks.join(""), answer);

  await provider.cleanup();

  console.log(
    "\n✅ Gemini Provider Test Passed\n"
  );
}

main().catch((error) => {
  console.error(
    "\n❌ Gemini Provider Test Failed\n"
  );

  console.error(error);
  process.exitCode = 1;
});