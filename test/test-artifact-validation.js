#!/usr/bin/env node

// 測試 validateOutputsByType 驗證邏輯

import { ArtifactProductionService } from "../src/production/artifact-production-service.js";

console.log("🧪 Artifact Outputs 驗證測試\n");

// 建立一個 mock service (只用來測試驗證方法)
const mockService = new ArtifactProductionService({
  cell: { id: "test" },
  assistant: {},
  productionsDir: "/tmp/test",
});

console.log("測試 1: document type 只允許 .md 檔案\n");

// ✅ 有效的 document outputs
try {
  mockService.validateOutputsByType({
    type: "document",
    outputs: [
      { path: "design.md", language: "markdown" },
      { path: "readme.md", language: "markdown" },
    ],
  });
  console.log("✅ 有效的 document outputs: 通過");
} catch (error) {
  console.log("❌ 不應該失敗:", error.message);
}

// ❌ 無效的 document outputs (包含 Java)
try {
  mockService.validateOutputsByType({
    type: "document",
    outputs: [
      { path: "design.md", language: "markdown" },
      { path: "src/main/java/App.java", language: "java" },
    ],
  });
  console.log("❌ 不應該通過 - document 不能包含 Java");
} catch (error) {
  console.log("✅ 正確攔截無效 document outputs");
  console.log(`   錯誤訊息: ${error.message}`);
}

console.log("\n測試 2: code type 允許多種檔案類型\n");

// ✅ code type 可以包含多種檔案
try {
  mockService.validateOutputsByType({
    type: "code",
    outputs: [
      { path: "src/App.java", language: "java" },
      { path: "config.yaml", language: "yaml" },
      { path: "README.md", language: "markdown" },
    ],
  });
  console.log("✅ code type 允許多種檔案: 通過");
} catch (error) {
  console.log("❌ code type 應該允許多種檔案:", error.message);
}

console.log("\n測試 3: generic type 不驗證\n");

// ✅ generic type 不做驗證
try {
  mockService.validateOutputsByType({
    type: "generic",
    outputs: [
      { path: "anything.txt", language: "text" },
      { path: "whatever.xyz", language: "unknown" },
    ],
  });
  console.log("✅ generic type 不做驗證: 通過");
} catch (error) {
  console.log("❌ generic type 不應該驗證:", error.message);
}

console.log("\n🎉 驗證邏輯測試完成!");
