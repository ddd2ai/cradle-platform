import { createCopilotProvider } from "../src/providers/copilot-provider.js";

const provider = await createCopilotProvider({
  model: "gpt-5-mini",
});

console.log("Testing CopilotProvider raw response...\n");

const result = await provider.ask({
  prompt: `只輸出以下 JSON,不要解釋:

{
  "type": "code",
  "title": "Test",
  "outputs": []
}`,
});

console.log("=== RAW RESULT START ===");
console.log(result);
console.log("=== RAW RESULT END ===");

// 檢測 corrupted patterns
const corruptedPatterns = [
  "typetype",
  "titletitle",
  "codecode",
  "LibraryLibrary",
  "{{",
  '" "',
];

const foundPatterns = corruptedPatterns.filter((pattern) =>
  result.includes(pattern)
);

if (foundPatterns.length > 0) {
  console.error("\n❌ CORRUPTED PATTERNS DETECTED:");
  foundPatterns.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
} else {
  console.log("\n✅ No corrupted patterns found");
  process.exit(0);
}
