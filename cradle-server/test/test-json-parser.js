#!/usr/bin/env node

// 測試 JSON 解析器的各種情境

import { parseLooseJsonObject } from "../src/utils/json.js";

const tests = [
  {
    name: "純 JSON",
    input: '{"type": "code", "title": "Test"}',
    expected: { type: "code", title: "Test" },
  },
  {
    name: "JSON with markdown fence",
    input: '```json\n{"type": "document"}\n```',
    expected: { type: "document" },
  },
  {
    name: "前後有廢話",
    input: '根據給定的規則,以下是 JSON:\n\n{"type": "diagram"}\n\n這個輸出符合規則。',
    expected: { type: "diagram" },
  },
  {
    name: "LLM 典型回應",
    input: `好的,我會產生 Artifact JSON。

\`\`\`json
{
  "type": "code",
  "title": "測試程式碼",
  "goal": "建立測試",
  "plan": {
    "summary": "簡單測試",
    "steps": ["步驟1", "步驟2"]
  },
  "outputs": [
    {
      "kind": "file",
      "path": "test.js",
      "language": "javascript",
      "content": "console.log('test');"
    }
  ],
  "notes": []
}
\`\`\`

這個 JSON 符合所有規則。`,
    expected: {
      type: "code",
      title: "測試程式碼",
      goal: "建立測試",
      plan: { summary: "簡單測試", steps: ["步驟1", "步驟2"] },
      outputs: [
        {
          kind: "file",
          path: "test.js",
          language: "javascript",
          content: "console.log('test');",
        },
      ],
      notes: [],
    },
  },
  {
    name: "只有 fallback (抓第一個 { 到最後一個 })",
    input: "這裡有一些文字 { \"test\": true } 還有更多文字",
    expected: { test: true },
  },
];

console.log("🧪 JSON Parser 容錯測試\n");

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const result = parseLooseJsonObject(test.input);
    const resultStr = JSON.stringify(result);
    const expectedStr = JSON.stringify(test.expected);

    if (resultStr === expectedStr) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   預期: ${expectedStr}`);
      console.log(`   實際: ${resultStr}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.name} - 拋出錯誤`);
    console.log(`   ${error.message}`);
    failed++;
  }
}

console.log(`\n📊 測試結果: ${passed} 通過, ${failed} 失敗`);

if (failed === 0) {
  console.log("🎉 所有測試通過!");
  process.exit(0);
} else {
  console.log("⚠️  有測試失敗");
  process.exit(1);
}
