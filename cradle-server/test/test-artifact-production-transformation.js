/**
 * test-artifact-production-transformation.js
 * 
 * Test artifact production transformation (integration with fake requester)
 */

import { ArtifactProductionService } from "../src/production/artifact-production-service.js";
import { buildArtifactTransformationPrompt } from "../src/production/artifact-transformation-prompt.js";

// Fake Cell
class FakeCell {
  constructor() {
    this.id = "cell-test";
    this.provider = "test-provider";
    this.model = "test-model";
    this.historyLines = [];
    this.thoughtLines = [];
  }

  async readEnvironment() {
    return "Node.js 20, PostgreSQL 15";
  }

  async askWithTimeout(prompt, timeout) {
    return {
        text: JSON.stringify({
        type: "code",
        title: "Test Service",
        goal: "Test Goal",

        plan: {
            summary: "Create test service",
            steps: [
            "Create TestService",
            "Add execute method",
            ],
        },

        outputs: [
            {
            kind: "file",
            path: "test.js",
            language: "javascript",

            content: [
                "export class TestService {",
                "  execute() {",
                "    return 'test';",
                "  }",
                "}",
                "",
            ].join("\n"),
            },
        ],

        notes: [
            "Generated from transformation",
        ],
        }),
    };
  }

  formatTimestamp(date) {
    return date.toISOString().replace(/[:.]/g, "-");
  }

  async appendHistory(text) {
    this.historyLines.push(text);
  }

  async appendThought(text) {
    this.thoughtLines.push(text);
  }

  async mature(amount) {
    // no-op
  }
}

// Fake Assistant
class FakeAssistant {
  async ask() {
    return "fake response";
  }
}

async function runTests() {
  console.log("Testing Artifact Production Transformation...\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Prompt includes Living Context
  {
    console.log("Test 1: Prompt includes Living Context");
    
    const prompt = buildArtifactTransformationPrompt({
      type: "code",
      title: "Service",
      goal: "Create service",
      constraints: [],
      environment: "Node.js",
      livingContext: {
        purpose: "Payment Processing",
        responsibilities: ["Handle payments"],
        excludes: ["Authentication"]
      },
      distilledMemory: {},
      sourceArtifacts: []
    });

    if (
      prompt.includes("Payment Processing") &&
      prompt.includes("Handle payments") &&
      prompt.includes("Authentication")
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Prompt should include Living Context\n");
      failed++;
    }
  }

  // Test 2: Prompt includes Goal
  {
    console.log("Test 2: Prompt includes Goal");
    
    const prompt = buildArtifactTransformationPrompt({
      type: "code",
      title: "Service",
      goal: "Create payment validation",
      constraints: [],
      environment: "Node.js",
      livingContext: { purpose: "Payments" },
      distilledMemory: {},
      sourceArtifacts: []
    });

    if (prompt.includes("Create payment validation")) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Prompt should include Goal\n");
      failed++;
    }
  }

  // Test 3: Prompt includes Constraints
  {
    console.log("Test 3: Prompt includes Constraints");
    
    const prompt = buildArtifactTransformationPrompt({
      type: "code",
      title: "Service",
      goal: "Create service",
      constraints: ["Must use async/await", "No external dependencies"],
      environment: "Node.js",
      livingContext: { purpose: "Test" },
      distilledMemory: {},
      sourceArtifacts: []
    });

    if (
      prompt.includes("Must use async/await") &&
      prompt.includes("No external dependencies")
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Prompt should include Constraints\n");
      failed++;
    }
  }

  // Test 4: Prompt includes Distilled Memory
  {
    console.log("Test 4: Prompt includes Distilled Memory");
    
    const prompt = buildArtifactTransformationPrompt({
      type: "code",
      title: "Service",
      goal: "Create service",
      constraints: [],
      environment: "Node.js",
      livingContext: { purpose: "Test" },
      distilledMemory: {
        knowledge: "Payment rules: validate before processing",
        history: "Previously handled 1000+ transactions"
      },
      sourceArtifacts: []
    });

    if (
      prompt.includes("Payment rules: validate before processing") &&
      prompt.includes("Previously handled 1000+ transactions")
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Prompt should include Distilled Memory\n");
      failed++;
    }
  }

  // Test 5: Prompt includes Source Artifacts
  {
    console.log("Test 5: Prompt includes Source Artifacts");
    
    const prompt = buildArtifactTransformationPrompt({
      type: "code",
      title: "Service",
      goal: "Create service",
      constraints: [],
      environment: "Node.js",
      livingContext: { purpose: "Test" },
      distilledMemory: {},
      sourceArtifacts: [
        {
          id: "artifact-payment",
          type: "code",
          title: "Payment Handler",
          goal: "Process payments",
          outputs: [
            {
              path: "payment.js",
              content: "function processPayment() { }"
            }
          ]
        }
      ]
    });

    if (
      prompt.includes("artifact-payment") &&
      prompt.includes("Payment Handler") &&
      prompt.includes("function processPayment")
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Prompt should include Source Artifacts\n");
      failed++;
    }
  }

  // Test 6: Prompt says Source Artifacts are not templates
  {
    console.log("Test 6: Prompt says Source Artifacts are not templates");
    
    const prompt = buildArtifactTransformationPrompt({
      type: "code",
      title: "Service",
      goal: "Create service",
      constraints: [],
      environment: "Node.js",
      livingContext: { purpose: "Test" },
      distilledMemory: {},
      sourceArtifacts: [
        {
          id: "artifact-test",
          type: "code",
          title: "Test",
          goal: "Test",
          outputs: []
        }
      ]
    });

    if (
      prompt.includes("REFERENCE MATERIAL") &&
      (prompt.includes("NOT mandatory templates") || prompt.includes("不是必須保留"))
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Prompt should clarify Source Artifacts are not templates\n");
      failed++;
    }
  }

  // Test 7: Prompt includes sourceWarnings
  {
    console.log("Test 7: Prompt includes sourceWarnings");
    
    const prompt = buildArtifactTransformationPrompt({
      type: "code",
      title: "Service",
      goal: "Create service",
      constraints: [],
      environment: "Node.js",
      livingContext: { purpose: "Test" },
      distilledMemory: {},
      sourceArtifacts: [],
      sourceWarnings: [
        "artifact-missing: Not found",
        "artifact-error: Load failed"
      ]
    });

    if (
      prompt.includes("artifact-missing: Not found") &&
      prompt.includes("artifact-error: Load failed")
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Prompt should include sourceWarnings\n");
      failed++;
    }
  }

  // Test 8: produceFromTransformation creates artifact with origin
  {
    console.log("Test 8: produceFromTransformation creates artifact with origin");
    
    const cell = new FakeCell();
    const assistant = new FakeAssistant();
    
    const service = new ArtifactProductionService({
      cell,
      assistant,
      productionsDir: "/tmp/test-productions"
    });

    try {
      const result = await service.produceFromTransformation({
        type: "code",
        title: "Test Service",
        goal: "Create test service",
        constraints: [],
        livingContext: { purpose: "Test" },
        distilledMemory: {},
        sourceArtifacts: [],
        sourceWarnings: [],
        origin: {
          mode: "division",
          sourceCellIds: ["cell-parent"],
          sourceArtifactIds: ["artifact-123"],
          livingContextId: "living-context-child"
        }
      });

      if (
        result.artifact.origin &&
        result.artifact.origin.mode === "division" &&
        result.artifact.origin.sourceCellIds[0] === "cell-parent"
      ) {
        console.log("  ✅ PASS\n");
        passed++;
      } else {
        console.log("  ❌ FAIL: Artifact should have origin\n");
        console.log("  Origin:", result.artifact.origin);
        failed++;
      }
    } catch (error) {
      console.log("  ❌ FAIL: Error during production\n");
      console.log("  Error:", error.message);
      failed++;
    }
  }

  // Test 9: Old produce() still works without origin
  {
    console.log("Test 9: Old produce() still works without origin");
    
    const cell = new FakeCell();
    const assistant = new FakeAssistant();
    
    cell.askWithTimeout = async () => ({
    text: JSON.stringify({
        type: "code",
        title: "Test",
        goal: "Create test",

        plan: {
        summary: "Create a simple test module",
        steps: [
            "Create exported function",
        ],
        },

        outputs: [
        {
            kind: "file",
            path: "test.js",
            language: "javascript",

            content: [
            "export function runTest() {",
            "  return true;",
            "}",
            "",
            ].join("\n"),
        },
        ],

        notes: [],
    }),
    });
    
    const service = new ArtifactProductionService({
      cell,
      assistant,
      productionsDir: "/tmp/test-productions"
    });

    try {
      const result = await service.produce({
        type: "code",
        title: "Test",
        goal: "Create test"
      });

      // Old produce should work, origin is optional
      if (result.artifact) {
        console.log("  ✅ PASS\n");
        passed++;
      } else {
        console.log("  ❌ FAIL: Old produce() should still work\n");
        failed++;
      }
    } catch (error) {
      console.log("  ❌ FAIL: Error during old produce\n");
      console.log("  Error:", error.message);
      failed++;
    }
  }

  // Summary
  console.log("=".repeat(50));
  console.log(`Total: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("=".repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error("Test runner error:", error);
  process.exit(1);
});
