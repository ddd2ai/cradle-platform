/**
 * test-source-material-service.js
 *
 * 測試 SourceMaterialService 的資訊收集、Artifact Catalog
 * 與 Source Artifact 載入限制。
 */

import assert from "node:assert/strict";

import {
  SourceMaterialService,
} from "../src/living-context/source-material-service.js";

console.log("Testing Source Material Service...\n");

const service = new SourceMaterialService();

const longKnowledge = "A".repeat(15000);
const longContent = "X".repeat(10000);

const artifactMap = new Map([
  [
    "artifact-001",
    {
      id: "artifact-001",
      type: "code",
      title: "Test Artifact 1",
      goal: "Create a test JavaScript artifact",
      status: "draft",

      outputs: [
        {
          kind: "file",
          path: "test.js",
          language: "javascript",
          content: "console.log('hello');",
        },
      ],

      notes: [
        "Short test artifact",
      ],
    },
  ],

  [
    "artifact-002",
    {
      id: "artifact-002",
      type: "document",
      title: "Test Artifact 2",
      goal: "Create a document with long content",
      status: "draft",

      outputs: [
        {
          kind: "file",
          path: "long.txt",
          language: "text",
          content: longContent,
        },
      ],

      notes: [
        "Artifact containing long content",
      ],
    },
  ],
]);

const fakeArtifactStore = {
  async listArtifactSummaries() {
    return {
      artifacts: [
        {
          artifactId: "artifact-001",
          type: "code",
          title: "Test Artifact 1",
          goal: "Create a test JavaScript artifact",
          status: "draft",
          outputPaths: [
            "test.js",
          ],
          languages: [
            "javascript",
          ],
          notes: [
            "Short test artifact",
          ],
        },

        {
          artifactId: "artifact-002",
          type: "document",
          title: "Test Artifact 2",
          goal: "Create a document with long content",
          status: "draft",
          outputPaths: [
            "long.txt",
          ],
          languages: [
            "text",
          ],
          notes: [
            "Artifact containing long content",
          ],
        },
      ],

      errors: [
        {
          artifactId: "artifact-003",
          error: "Invalid JSON",
        },
      ],
    };
  },

  async readArtifact(artifactId) {
    const artifact = artifactMap.get(artifactId);

    if (!artifact) {
      throw new Error(
        `Artifact not found: ${artifactId}`
      );
    }

    return structuredClone(artifact);
  },

  // 同時提供批次版本，讓測試相容不同實作方式
  async readArtifacts(artifactIds = []) {
    const artifacts = [];
    const errors = [];

    for (const artifactId of artifactIds) {
      try {
        const artifact =
          await this.readArtifact(artifactId);

        artifacts.push(artifact);
      } catch (error) {
        errors.push({
          artifactId,
          error: error.message,
        });
      }
    }

    return {
      artifacts,
      errors,
    };
  },
};

const memoryValues = {
  identity: "# Identity\n\nI am test-cell.",

  rules: [
    "# Rules",
    "",
    "- Follow Living Context.",
    "- Keep responsibilities explicit.",
  ].join("\n"),

  knowledge: longKnowledge,

  history: [
    "# History",
    "",
    "- History 1",
    "- History 2",
  ].join("\n"),

  "recent-history": [
    "# Recent History",
    "",
    "- History 1",
    "- History 2",
  ].join("\n"),

  thoughts: [
    "# Thoughts",
    "",
    "- Thought 1",
    "- Thought 2",
  ].join("\n"),

  "recent-thoughts": [
    "# Recent Thoughts",
    "",
    "- Thought 1",
    "- Thought 2",
  ].join("\n"),
};

const fakeCell = {
  id: "test-cell",

  memoryDir: "/fake/memory",
  thoughtsDir: "/fake/thoughts",

  productionService: {
    store: fakeArtifactStore,
  },

  // 使用 getter 讓 artifactStore 指向 productionService.store
  get artifactStore() {
    return this.productionService.store;
  },

  async readProfile() {
    return {
      id: "test-cell",
      cellId: "test-cell",
      purpose: "Test cell for source material",
      responsibilities: [
        "Task A",
        "Task B",
      ],
    };
  },

  async readLivingContext() {
    return {
      id: "living-context-test-cell",
      cellId: "test-cell",
      purpose: "Test purpose",

      responsibilities: [
        "Task A",
      ],

      owns: [],
      excludes: [],
      inputs: [],
      outputs: [],

      constraints: [
        "Constraint 1",
      ],

      relationships: [],
    };
  },

  async readDNAVector() {
    return {
      cellId: "test-cell",
      maturity: 0.5,

      factors: {
        stability: {
          value: 0.6,
          weight: 1,
        },

        growth: {
          value: 0.4,
          weight: 1,
        },
      },
    };
  },

  async listResponsibilities() {
    return [
      "Task A",
      "Task B",
    ];
  },

  async getRelationships() {
    return [];
  },

  async readMemory(name) {
    return memoryValues[name] ?? "";
  },
};

// Test 1: buildCellSourceMaterial 收集所有資訊
{
  const sourceMaterial =
    await service.buildCellSourceMaterial(fakeCell);

  assert.equal(
    sourceMaterial.cellId,
    "test-cell"
  );

  assert.ok(
    sourceMaterial.profile,
    "Should have profile"
  );

  assert.equal(
    sourceMaterial.profile.cellId,
    "test-cell"
  );

  assert.ok(
    sourceMaterial.livingContext,
    "Should have Living Context"
  );

  assert.equal(
    sourceMaterial.livingContext.cellId,
    "test-cell"
  );

  assert.ok(
    sourceMaterial.dnaVector,
    "Should have DNA vector"
  );

  assert.ok(
    sourceMaterial.memory,
    "Should have memory"
  );

  assert.equal(
    typeof sourceMaterial.memory.knowledge,
    "string"
  );

  assert.equal(
    typeof sourceMaterial.memory.recentHistory,
    "string"
  );

  assert.equal(
    typeof sourceMaterial.memory.recentThoughts,
    "string"
  );

  assert.ok(
    Array.isArray(sourceMaterial.artifactCatalog),
    "artifactCatalog should be an array"
  );

  assert.ok(
    Array.isArray(
      sourceMaterial.artifactCatalogErrors
    ),
    "artifactCatalogErrors should be an array"
  );

  console.log(
    "✓ buildCellSourceMaterial collects all info"
  );
}

// Test 2: Memory 遵守長度限制
{
  const sourceMaterial =
    await service.buildCellSourceMaterial(fakeCell);

  assert.ok(
    sourceMaterial.memory.knowledge.length <= 12000,
    [
      "Knowledge should be <= 12000 chars, got",
      sourceMaterial.memory.knowledge.length,
    ].join(" ")
  );

  assert.ok(
    sourceMaterial.memory.recentHistory.length <= 8000,
    [
      "History should be <= 8000 chars, got",
      sourceMaterial.memory.recentHistory.length,
    ].join(" ")
  );

  assert.ok(
    sourceMaterial.memory.recentThoughts.length <= 5000,
    [
      "Thoughts should be <= 5000 chars, got",
      sourceMaterial.memory.recentThoughts.length,
    ].join(" ")
  );

  assert.ok(
    sourceMaterial.memory.knowledge.includes(
      "[truncated]"
    ),
    "Long knowledge should contain truncation marker"
  );

  console.log(
    "✓ memory respects length limits"
  );
}

// Test 3: Artifact Catalog 只有 metadata
{
  const catalogResult =
    await service.buildArtifactCatalog(fakeCell);

  assert.ok(
    Array.isArray(catalogResult.artifacts),
    "Should return artifacts array"
  );

  assert.ok(
    Array.isArray(catalogResult.errors),
    "Should return errors array"
  );

  assert.equal(
    catalogResult.artifacts.length,
    2
  );

  for (const artifact of catalogResult.artifacts) {
    assert.ok(
      artifact.artifactId,
      "Should have artifactId"
    );

    assert.ok(
      artifact.type,
      "Should have type"
    );

    assert.ok(
      artifact.title,
      "Should have title"
    );

    assert.ok(
      artifact.goal,
      "Should have goal"
    );

    assert.ok(
      Array.isArray(artifact.outputPaths),
      "Should have outputPaths"
    );

    assert.equal(
      artifact.outputs,
      undefined,
      "Catalog should not contain full outputs"
    );

    assert.equal(
      JSON.stringify(artifact).includes(
        "console.log"
      ),
      false,
      "Catalog should not contain source content"
    );
  }

  console.log(
    "✓ artifact catalog has metadata only"
  );
}

// Test 4: 損壞 Artifact 被隔離
{
  const catalogResult =
    await service.buildArtifactCatalog(fakeCell);

  const brokenError =
    catalogResult.errors.find(
      (error) =>
        error.artifactId === "artifact-003"
    );

  assert.ok(
    brokenError,
    "Should have error for artifact-003"
  );

  assert.ok(
    brokenError.error,
    "Broken artifact error should have message"
  );

  console.log(
    "✓ broken artifacts are isolated"
  );
}

// Test 5: loadSelectedArtifacts 遵守內容限制
{
  const result =
    await service.loadSelectedArtifacts(
      fakeCell,
      [
        "artifact-001",
        "artifact-002",
      ]
    );

  assert.ok(
    Array.isArray(result.artifacts),
    "Should return artifacts array"
  );

  assert.ok(
    Array.isArray(result.errors),
    "Should return errors array"
  );

  assert.equal(
    result.artifacts.length,
    2
  );

  const artifact2 =
    result.artifacts.find(
      (artifact) =>
        artifact.id === "artifact-002"
    );

  assert.ok(
    artifact2,
    "Should load artifact-002"
  );

  const output =
    artifact2.outputs[0];

  assert.ok(
    output.content.length <= 8000,
    [
      "Each output should be <= 8000 chars, got",
      output.content.length,
    ].join(" ")
  );

  assert.ok(
    output.content.includes("[truncated]"),
    "Truncated content should contain marker"
  );

  let totalContentLength = 0;

  for (const artifact of result.artifacts) {
    for (const artifactOutput of artifact.outputs ?? []) {
      totalContentLength +=
        String(artifactOutput.content ?? "").length;
    }
  }

  assert.ok(
    totalContentLength <= 30000,
    [
      "Total content should be <= 30000 chars, got",
      totalContentLength,
    ].join(" ")
  );

  console.log(
    "✓ loadSelectedArtifacts respects content limits"
  );
}

// Test 6: 不存在的 Artifact 回傳 error
{
  const result =
    await service.loadSelectedArtifacts(
      fakeCell,
      [
        "non-existent-artifact",
      ]
    );

  assert.equal(
    result.artifacts.length,
    0
  );

  const error =
    result.errors.find(
      (item) =>
        item.artifactId ===
        "non-existent-artifact"
    );

  assert.ok(
    error,
    "Should return missing artifact error"
  );

  console.log(
    "✓ non-existent artifacts return errors"
  );
}

// Test 7: 空 Artifact ID 清單
{
  const result =
    await service.loadSelectedArtifacts(
      fakeCell,
      []
    );

  assert.deepEqual(
    result,
    {
      artifacts: [],
      errors: [],
    }
  );

  console.log(
    "✓ empty artifact list returns empty arrays"
  );
}

// Test 8: buildCellSourceMaterial Catalog 與直接查詢一致
{
  const sourceMaterial =
    await service.buildCellSourceMaterial(fakeCell);

  const catalogResult =
    await service.buildArtifactCatalog(fakeCell);

  assert.equal(
    sourceMaterial.artifactCatalog.length,
    catalogResult.artifacts.length,
    "Catalog artifact count should match"
  );

  assert.equal(
    sourceMaterial.artifactCatalogErrors.length,
    catalogResult.errors.length,
    "Catalog error count should match"
  );

  console.log(
    "✓ source material catalog matches catalog service"
  );
}

console.log(
  "\n✅ All Source Material Service tests passed!"
);