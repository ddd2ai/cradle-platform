/**
 * test-artifact-regeneration-service.js
 * 
 * Test ArtifactRegenerationService
 */

import { ArtifactRegenerationService } from "../src/production/artifact-regeneration-service.js";

// Fake SourceMaterialService
class FakeSourceMaterialService {
  constructor(options = {}) {
    this.artifactsToReturn = options.artifactsToReturn || [];
    this.errorsToReturn = options.errorsToReturn || [];
  }

  async loadSelectedArtifacts(cell, artifactIds) {
    return {
      artifacts: this.artifactsToReturn,
      errors: this.errorsToReturn
    };
  }
}

// Fake ProductionService
class FakeProductionService {
  constructor() {
    this.calls = [];
  }

  async produceFromTransformation(options) {
    this.calls.push(options);

    // Return a fake artifact
    return {
      id: `artifact-test-${Date.now()}`,
      type: options.type,
      title: options.title,
      goal: options.goal,
      origin: options.origin
    };
  }
}

async function runTests() {
  console.log("Testing ArtifactRegenerationService...\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Empty productionPlan returns complete true
  {
    console.log("Test 1: Empty productionPlan returns complete true");
    
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService()
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-child",
      productionService: new FakeProductionService()
    };
    const divisionPlan = {
      productionPlan: [],
      childLivingContext: {},
      childMemorySeed: {}
    };

    const result = await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    if (
      result.produced.length === 0 &&
      result.failed.length === 0 &&
      result.complete === true
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Expected complete=true with empty arrays\n");
      failed++;
    }
  }

  // Test 2: Each item calls produceFromTransformation once
  {
    console.log("Test 2: Each item calls produceFromTransformation once");
    
    const fakeProductionService = new FakeProductionService();
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService()
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-child",
      productionService: fakeProductionService
    };
    const divisionPlan = {
      productionPlan: [
        { type: "code", title: "Service A", goal: "Create A", sourceArtifactIds: [] },
        { type: "test", title: "Test B", goal: "Create B", sourceArtifactIds: [] }
      ],
      childLivingContext: { purpose: "Test" },
      childMemorySeed: {}
    };

    await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    if (fakeProductionService.calls.length === 2) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log(`  ❌ FAIL: Expected 2 calls, got ${fakeProductionService.calls.length}\n`);
      failed++;
    }
  }

  // Test 3: Living Context passed correctly
  {
    console.log("Test 3: Living Context passed correctly");
    
    const fakeProductionService = new FakeProductionService();
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService()
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-child",
      productionService: fakeProductionService
    };
    const divisionPlan = {
      productionPlan: [
        { type: "code", title: "Service", goal: "Create", sourceArtifactIds: [] }
      ],
      childLivingContext: { purpose: "Payment Processing", responsibilities: ["payments"] },
      childMemorySeed: { knowledge: "Payment rules" }
    };

    await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    const call = fakeProductionService.calls[0];
    if (
      call.livingContext.purpose === "Payment Processing" &&
      call.distilledMemory.knowledge === "Payment rules"
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Living Context not passed correctly\n");
      failed++;
    }
  }

  // Test 4: origin.mode is division
  {
    console.log("Test 4: origin.mode is division");
    
    const fakeProductionService = new FakeProductionService();
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService()
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-child",
      productionService: fakeProductionService
    };
    const divisionPlan = {
      productionPlan: [
        { type: "code", title: "Service", goal: "Create", sourceArtifactIds: [] }
      ],
      childLivingContext: {},
      childMemorySeed: {}
    };

    await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    const call = fakeProductionService.calls[0];
    if (call.origin.mode === "division") {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log(`  ❌ FAIL: Expected origin.mode=division, got ${call.origin.mode}\n`);
      failed++;
    }
  }

  // Test 5: sourceCellIds correct
  {
    console.log("Test 5: sourceCellIds correct");
    
    const fakeProductionService = new FakeProductionService();
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService()
    });

    const parentCell = { id: "cell-parent-123" };
    const childCell = { 
      id: "cell-child",
      productionService: fakeProductionService
    };
    const divisionPlan = {
      productionPlan: [
        { type: "code", title: "Service", goal: "Create", sourceArtifactIds: [] }
      ],
      childLivingContext: {},
      childMemorySeed: {}
    };

    await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    const call = fakeProductionService.calls[0];
    if (
      call.origin.sourceCellIds.length === 1 &&
      call.origin.sourceCellIds[0] === "cell-parent-123"
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: sourceCellIds incorrect\n");
      failed++;
    }
  }

  // Test 6: sourceArtifactIds correct
  {
    console.log("Test 6: sourceArtifactIds correct");
    
    const fakeProductionService = new FakeProductionService();
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService()
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-child",
      productionService: fakeProductionService
    };
    const divisionPlan = {
      productionPlan: [
        { 
          type: "code", 
          title: "Service", 
          goal: "Create", 
          sourceArtifactIds: ["artifact-123", "artifact-456"] 
        }
      ],
      childLivingContext: {},
      childMemorySeed: {}
    };

    await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    const call = fakeProductionService.calls[0];
    if (
      call.origin.sourceArtifactIds.length === 2 &&
      call.origin.sourceArtifactIds[0] === "artifact-123"
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: sourceArtifactIds incorrect\n");
      failed++;
    }
  }

  // Test 7: livingContextId correct
  {
    console.log("Test 7: livingContextId correct");
    
    const fakeProductionService = new FakeProductionService();
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService()
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-payment",
      productionService: fakeProductionService
    };
    const divisionPlan = {
      productionPlan: [
        { type: "code", title: "Service", goal: "Create", sourceArtifactIds: [] }
      ],
      childLivingContext: {},
      childMemorySeed: {}
    };

    await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    const call = fakeProductionService.calls[0];
    if (call.origin.livingContextId === "living-context-cell-payment") {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log(`  ❌ FAIL: Expected living-context-cell-payment, got ${call.origin.livingContextId}\n`);
      failed++;
    }
  }

  // Test 8: No sourceArtifact still generates
  {
    console.log("Test 8: No sourceArtifact still generates");
    
    const fakeProductionService = new FakeProductionService();
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService({
        artifactsToReturn: []
      })
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-child",
      productionService: fakeProductionService
    };
    const divisionPlan = {
      productionPlan: [
        { type: "code", title: "Service", goal: "Create", sourceArtifactIds: [] }
      ],
      childLivingContext: {},
      childMemorySeed: {}
    };

    const result = await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    if (result.produced.length === 1 && result.failed.length === 0) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Should generate even without source artifacts\n");
      failed++;
    }
  }

  // Test 9: Source loading errors become warnings
  {
    console.log("Test 9: Source loading errors become warnings");
    
    const fakeProductionService = new FakeProductionService();
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService({
        artifactsToReturn: [],
        errorsToReturn: [
          { artifactId: "artifact-missing", error: "Not found" }
        ]
      })
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-child",
      productionService: fakeProductionService
    };
    const divisionPlan = {
      productionPlan: [
        { type: "code", title: "Service", goal: "Create", sourceArtifactIds: ["artifact-missing"] }
      ],
      childLivingContext: {},
      childMemorySeed: {}
    };

    const result = await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    const call = fakeProductionService.calls[0];
    if (
      result.produced.length === 1 &&
      call.sourceWarnings.length === 1 &&
      call.sourceWarnings[0].includes("artifact-missing")
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Source errors should become warnings\n");
      failed++;
    }
  }

  // Test 10: Single failure doesn't affect others
  {
    console.log("Test 10: Single failure doesn't affect others");
    
    class FailingProductionService {
      constructor() {
        this.callCount = 0;
      }

      async produceFromTransformation(options) {
        this.callCount++;
        
        if (options.title === "Failing Item") {
          throw new Error("Production failed");
        }

        return {
          id: `artifact-test-${Date.now()}`,
          type: options.type,
          title: options.title
        };
      }
    }

    const failingService = new FailingProductionService();
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService()
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-child",
      productionService: failingService
    };
    const divisionPlan = {
      productionPlan: [
        { type: "code", title: "Good Item 1", goal: "Create 1", sourceArtifactIds: [] },
        { type: "code", title: "Failing Item", goal: "Create 2", sourceArtifactIds: [] },
        { type: "code", title: "Good Item 2", goal: "Create 3", sourceArtifactIds: [] }
      ],
      childLivingContext: {},
      childMemorySeed: {}
    };

    const result = await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    if (
      failingService.callCount === 3 &&
      result.produced.length === 2 &&
      result.failed.length === 1 &&
      result.failed[0].title === "Failing Item"
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Failures should not stop other items\n");
      console.log(`    Calls: ${failingService.callCount}, Produced: ${result.produced.length}, Failed: ${result.failed.length}`);
      failed++;
    }
  }

  // Test 11: complete based on failures
  {
    console.log("Test 11: complete based on failures");
    
    class AlwaysFailingService {
      async produceFromTransformation() {
        throw new Error("Always fails");
      }
    }

    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService()
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-child",
      productionService: new AlwaysFailingService()
    };
    const divisionPlan = {
      productionPlan: [
        { type: "code", title: "Item", goal: "Create", sourceArtifactIds: [] }
      ],
      childLivingContext: {},
      childMemorySeed: {}
    };

    const result = await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    if (result.complete === false && result.failed.length === 1) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: complete should be false when items fail\n");
      failed++;
    }
  }

  // Test 12: Returns artifactId
  {
    console.log("Test 12: Returns artifactId");
    
    const fakeProductionService = new FakeProductionService();
    const service = new ArtifactRegenerationService({
      sourceMaterialService: new FakeSourceMaterialService()
    });

    const parentCell = { id: "cell-parent" };
    const childCell = { 
      id: "cell-child",
      productionService: fakeProductionService
    };
    const divisionPlan = {
      productionPlan: [
        { type: "code", title: "Service", goal: "Create", sourceArtifactIds: [] }
      ],
      childLivingContext: {},
      childMemorySeed: {}
    };

    const result = await service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan
    });

    if (
      result.produced.length === 1 &&
      result.produced[0].artifactId &&
      result.produced[0].artifactId.startsWith("artifact-test-")
    ) {
      console.log("  ✅ PASS\n");
      passed++;
    } else {
      console.log("  ❌ FAIL: Should return artifactId\n");
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
