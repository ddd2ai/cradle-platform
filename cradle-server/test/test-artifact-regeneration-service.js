import assert from "node:assert/strict";
import { ArtifactRegenerationService } from "../src/production/artifact-regeneration-service.js";

class FakeSourceMaterialService {
  constructor({ artifacts = [], errors = [] } = {}) {
    this.artifacts = artifacts;
    this.errors = errors;
  }

  async loadSelectedArtifacts() {
    return { artifacts: this.artifacts, errors: this.errors };
  }
}

class FakePairProductionService {
  constructor({ failOnCall } = {}) {
    this.calls = [];
    this.failOnCall = failOnCall;
  }

  async produceDivisionProductPair(options) {
    this.calls.push(options);
    if (this.calls.length === this.failOnCall) {
      throw new Error("Pair production failed");
    }

    const index = this.calls.length;
    return {
      parentProduct: {
        artifact: { id: `artifact-parent-${index}` },
        saved: { dir: `/parent/${index}` },
      },
      childProduct: {
        artifact: { id: `artifact-child-${index}` },
        saved: { dir: `/child/${index}` },
      },
      productContract: {
        apiInvocations: [{
          contractName: "Payment API",
          sourceRole: "parent",
          targetRole: "child",
          method: "POST",
          path: "/api/payments",
          requestSchema: [],
          responseSchema: [],
        }],
      },
    };
  }
}

function createCells(productionService = new FakePairProductionService()) {
  return {
    parentCell: { id: "cell-parent", productionService },
    childCell: {
      id: "cell-child",
      productionService: {
        async produceDivisionProductPair() {
          throw new Error("Child Cell must not produce division products");
        },
      },
    },
  };
}

function createDivisionPlan(productionPlan = [{
  sourceArtifactId: "artifact-source",
  action: "derive",
  type: "code",
  title: "Child Payment Service",
}]) {
  return {
    productionPlan,
    revisedParentLivingContext: { purpose: "Orders" },
    childLivingContext: { purpose: "Payments" },
    childMemorySeed: { knowledge: "Payment rules" },
    sharedContracts: [{ name: "Payment API" }],
  };
}

async function testRejectsIncompletePlan() {
  const service = new ArtifactRegenerationService({
    sourceMaterialService: new FakeSourceMaterialService(),
  });
  const { parentCell, childCell } = createCells();

  await assert.rejects(
    service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan: createDivisionPlan([]),
    }),
    /must create parent and child products/
  );
}

async function testParentProducesPairWithOneCall() {
  const events = [];
  const pairService = new FakePairProductionService();
  const originalProduce = pairService.produceDivisionProductPair.bind(pairService);
  pairService.produceDivisionProductPair = async (options) => {
    events.push("createProductPair");
    return originalProduce(options);
  };
  const { parentCell, childCell } = createCells(pairService);
  const service = new ArtifactRegenerationService({
    sourceMaterialService: new FakeSourceMaterialService({
      artifacts: [{
        id: "artifact-source",
        type: "code",
        title: "Order Service",
        goal: "Manage orders",
      }],
    }),
    artifactRelationService: {
      async linkDivisionProducts(options) {
        events.push("linkProducts");
        assert.equal(options.productContract.apiInvocations[0].path, "/api/payments");
        return {
          id: "relation-1",
          sourceProduct: {
            cellId: parentCell.id,
            artifactId: options.parentProduct.artifactId,
          },
          targetProduct: {
            cellId: childCell.id,
            artifactId: options.childProduct.artifactId,
          },
        };
      },
    },
  });

  const result = await service.regenerateForDivision({
    parentCell,
    childCell,
    divisionPlan: createDivisionPlan(),
  });

  assert.equal(pairService.calls.length, 1);
  assert.deepEqual(events, ["createProductPair", "linkProducts"]);
  assert.equal(result.parentRevisions[0].artifactId, "artifact-parent-1");
  assert.equal(result.produced[0].artifactId, "artifact-child-1");
  assert.equal(result.relations[0].id, "relation-1");
  assert.equal(result.complete, true);

  const request = pairService.calls[0];
  assert.equal(request.parentCell, parentCell);
  assert.equal(request.childCell, childCell);
  assert.equal(request.parentLivingContext.purpose, "Orders");
  assert.equal(request.childLivingContext.purpose, "Payments");
  assert.equal(request.sourceArtifacts[0].id, "artifact-source");
  assert.match(request.parentGoal, /Parent service/);
  assert.match(request.childGoal, /Spring Boot/);
}

async function testSourceErrorsBecomePairWarnings() {
  const pairService = new FakePairProductionService();
  const { parentCell, childCell } = createCells(pairService);
  const service = new ArtifactRegenerationService({
    sourceMaterialService: new FakeSourceMaterialService({
      errors: [{ artifactId: "missing", error: "Not found" }],
    }),
    artifactRelationService: {
      async linkDivisionProducts() {
        return { id: "relation-1" };
      },
    },
  });

  await service.regenerateForDivision({
    parentCell,
    childCell,
    divisionPlan: createDivisionPlan(),
  });

  assert.deepEqual(pairService.calls[0].sourceWarnings, ["missing: Not found"]);
}

async function testMultipleDerivationsUseOnePrompt() {
  const pairService = new FakePairProductionService();
  const { parentCell, childCell } = createCells(pairService);
  const service = new ArtifactRegenerationService({
    sourceMaterialService: new FakeSourceMaterialService(),
    artifactRelationService: {
      async linkDivisionProducts() {
        return { id: "relation-1" };
      },
    },
  });

  const result = await service.regenerateForDivision({
    parentCell,
    childCell,
    divisionPlan: createDivisionPlan([
      { sourceArtifactId: "one", action: "derive", title: "One" },
      { sourceArtifactId: "two", action: "derive", title: "Two" },
      { sourceArtifactId: "three", action: "derive", title: "Three" },
    ]),
  });

  assert.equal(pairService.calls.length, 1);
  assert.equal(result.produced.length, 1);
  assert.equal(result.parentRevisions.length, 1);
  assert.equal(result.failed.length, 0);
  assert.equal(result.complete, true);
  assert.deepEqual(pairService.calls[0].sourceArtifactIds, ["one", "two", "three"]);
}

async function testPairFailureLeavesNoCompleteProducts() {
  const pairService = new FakePairProductionService({ failOnCall: 1 });
  const { parentCell, childCell } = createCells(pairService);
  const service = new ArtifactRegenerationService({
    sourceMaterialService: new FakeSourceMaterialService(),
  });

  const result = await service.regenerateForDivision({
    parentCell,
    childCell,
    divisionPlan: createDivisionPlan(),
  });

  assert.equal(pairService.calls.length, 1);
  assert.equal(result.produced.length, 0);
  assert.equal(result.parentRevisions.length, 0);
  assert.equal(result.relations.length, 0);
  assert.equal(result.failed.length, 1);
  assert.equal(result.complete, false);
}

async function testKeepCannotCompleteDivision() {
  const pairService = new FakePairProductionService();
  const { parentCell, childCell } = createCells(pairService);
  const service = new ArtifactRegenerationService({
    sourceMaterialService: new FakeSourceMaterialService(),
  });

  await assert.rejects(
    service.regenerateForDivision({
      parentCell,
      childCell,
      divisionPlan: createDivisionPlan([{
        sourceArtifactId: "kept",
        action: "keep",
        title: "Kept",
      }]),
    }),
    /requires at least one derive action/
  );

  assert.equal(pairService.calls.length, 0);
}

async function runTests() {
  console.log("Testing ArtifactRegenerationService...");
  await testRejectsIncompletePlan();
  await testParentProducesPairWithOneCall();
  await testSourceErrorsBecomePairWarnings();
  await testMultipleDerivationsUseOnePrompt();
  await testPairFailureLeavesNoCompleteProducts();
  await testKeepCannotCompleteDivision();
  console.log("ArtifactRegenerationService tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
