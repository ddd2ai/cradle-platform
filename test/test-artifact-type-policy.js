#!/usr/bin/env node

// 測試 Artifact Type Policy

import { 
  ARTIFACT_TYPE_POLICIES, 
  getArtifactTypePolicy 
} from "../src/production/artifact-type-policy.js";

console.log("🧪 Artifact Type Policy 測試\n");

console.log("📋 支援的 Artifact Types:");
Object.keys(ARTIFACT_TYPE_POLICIES).forEach((type) => {
  console.log(`  - ${type}`);
});

console.log("\n📝 各 Type 的 Policy 詳情:\n");

for (const [type, policy] of Object.entries(ARTIFACT_TYPE_POLICIES)) {
  console.log(`🔹 ${type.toUpperCase()}`);
  console.log(`   Description: ${policy.description}`);
  console.log(`   Allowed Languages: ${policy.allowedLanguages.length === 0 ? "any" : policy.allowedLanguages.join(", ")}`);
  console.log(`   Allowed Extensions: ${policy.allowedExtensions.length === 0 ? "any" : policy.allowedExtensions.join(", ")}`);
  console.log(`   Output Rule: ${policy.outputRule}`);
  console.log("");
}

console.log("✅ 測試 getArtifactTypePolicy()\n");

// 測試已知 type
const docPolicy = getArtifactTypePolicy("document");
console.log(`✓ document policy: ${docPolicy.description}`);

const codePolicy = getArtifactTypePolicy("code");
console.log(`✓ code policy: ${codePolicy.description}`);

// 測試未知 type (應該 fallback 到 generic)
const unknownPolicy = getArtifactTypePolicy("unknown");
console.log(`✓ unknown type fallback: ${unknownPolicy.description}`);

console.log("\n🎉 所有測試通過!");
