import assert from "node:assert/strict";
import { ArtifactProductionService } from "../src/production/artifact-production-service.js";

class MemoryArtifactStore {
  constructor() {
    this.artifacts = [];
  }

  async saveArtifact(artifact) {
    this.artifacts.push(structuredClone(artifact));
    return { artifactId: artifact.id, dir: `/memory/${artifact.id}` };
  }
}

function createCell({ id, response, store, forbidAsk = false }) {
  return {
    id,
    provider: "fake",
    model: "fake-model",
    artifactStore: store,
    prompts: [],
    histories: [],
    async readEnvironment() {
      return `${id} environment`;
    },
    async askWithTimeout(prompt) {
      if (forbidAsk) {
        throw new Error("Child Cell must not be asked to generate division products");
      }
      this.prompts.push(prompt);
      return { text: JSON.stringify(response) };
    },
    formatTimestamp() {
      return "20260807-120000";
    },
    async appendHistory(history) {
      this.histories.push(history);
    },
  };
}

function product(title, content) {
  return {
    type: "generic",
    title,
    outputs: [{
      kind: "file",
      path: `${title}.txt`,
      language: "text",
      content,
    }],
    notes: [],
  };
}

function pairResponse({ childPath = "/api/payments" } = {}) {
  return {
    parentProduct: product(
      "母細胞訂單服務",
      "POST /api/payments client request orderId paymentId"
    ),
    childProduct: product(
      "子細胞付款服務",
      `POST ${childPath} controller response orderId paymentId`
    ),
    productContract: {
      apiInvocations: [{
        contractName: "Payment API",
        sourceRole: "parent",
        targetRole: "child",
        method: "POST",
        path: "/api/payments",
        requestSchema: [{ name: "orderId", type: "string", required: true }],
        responseSchema: [{ name: "paymentId", type: "string", required: true }],
      }],
    },
  };
}

function createRequest(parentCell, childCell) {
  return {
    parentCell,
    childCell,
    type: "generic",
    parentTitle: "Parent",
    childTitle: "Child",
    parentGoal: "Retain order ownership and call payment API",
    childGoal: "Own payment processing and expose payment API",
    parentLivingContext: { purpose: "Orders" },
    childLivingContext: { purpose: "Payments" },
    childMemorySeed: {},
    sharedContracts: [],
    sourceArtifactIds: ["artifact-source"],
  };
}

async function testOneParentPromptCreatesBothProducts() {
  const parentStore = new MemoryArtifactStore();
  const childStore = new MemoryArtifactStore();
  const parentCell = createCell({
    id: "cell-parent",
    response: pairResponse(),
    store: parentStore,
  });
  const childCell = createCell({
    id: "cell-child",
    store: childStore,
    forbidAsk: true,
  });
  const service = new ArtifactProductionService({
    cell: parentCell,
    assistant: {},
    productionsDir: "/unused",
  });
  service.store = parentStore;

  const result = await service.produceDivisionProductPair(
    createRequest(parentCell, childCell)
  );

  assert.equal(parentCell.prompts.length, 1);
  assert.equal(childCell.prompts.length, 0);
  assert.match(parentCell.prompts[0], /"parentProduct"/);
  assert.match(parentCell.prompts[0], /"childProduct"/);
  assert.match(parentCell.prompts[0], /"productContract"/);
  assert.equal(parentStore.artifacts.length, 1);
  assert.equal(childStore.artifacts.length, 1);
  assert.equal(result.parentProduct.artifact.origin.producerCellId, parentCell.id);
  assert.equal(result.childProduct.artifact.origin.producerCellId, parentCell.id);
  assert.equal(result.childProduct.artifact.origin.targetCellId, childCell.id);
  assert.notEqual(
    result.parentProduct.artifact.id,
    result.childProduct.artifact.id
  );
}

async function testMismatchedEndpointIsRejectedBeforeSaving() {
  const parentStore = new MemoryArtifactStore();
  const childStore = new MemoryArtifactStore();
  const parentCell = createCell({
    id: "cell-parent",
    response: pairResponse({ childPath: "/api/payment-requests" }),
    store: parentStore,
  });
  const childCell = createCell({
    id: "cell-child",
    store: childStore,
    forbidAsk: true,
  });
  const service = new ArtifactProductionService({
    cell: parentCell,
    assistant: {},
    productionsDir: "/unused",
  });
  service.store = parentStore;

  await assert.rejects(
    service.produceDivisionProductPair(createRequest(parentCell, childCell)),
    /child product does not implement path \/api\/payments/
  );
  assert.equal(parentCell.prompts.length, 1);
  assert.equal(parentStore.artifacts.length, 0);
  assert.equal(childStore.artifacts.length, 0);
}

async function runTests() {
  console.log("Testing division product pair production...");
  await testOneParentPromptCreatesBothProducts();
  await testMismatchedEndpointIsRejectedBeforeSaving();
  console.log("Division product pair production tests passed.");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
