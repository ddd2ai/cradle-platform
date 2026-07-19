/**
 * test-living-context-service.js
 * 
 * 測試 LivingContextService 的完整流程
 * 使用 fake cell 和 fake SourceMaterialService，不呼叫真實 Copilot
 */

import { LivingContextService } from '../src/living-context/living-context-service.js';

console.log('=== LivingContextService Tests ===\n');

let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  return new Promise((resolve) => {
    fn()
      .then(() => {
        passCount++;
        console.log(`✓ ${name}`);
        resolve();
      })
      .catch((error) => {
        console.error(`✗ ${name}`);
        console.error(`  ${error.message}`);
        if (error.cause) {
          console.error(`  Cause: ${error.cause.message}`);
        }
        resolve();
      });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// 建立測試用的假資料
const fakeDnaDivisionPlan = {
  sigma: 0.5,
  childDominantTraits: ["Payment"],
  childDominantFactors: { payment: 0.9 },
  reason: "Specialize payment processing"
};

// 建立 Fake SourceMaterialService
class FakeSourceMaterialService {
  constructor() {
    this.callCount = 0;
  }

  async buildCellSourceMaterial(cell) {
    this.callCount++;
    
    return {
      cellId: cell.id,
      profile: {},
      livingContext: {
        purpose: "Handle ordering and payment",
        responsibilities: ["Order", "Payment"],
        owns: ["Order", "Payment"],
        excludes: [],
        inputs: [],
        outputs: [],
        constraints: [],
        relationships: []
      },
      dnaVector: {},
      responsibilities: ["Order", "Payment"],
      relationships: [],
      memory: {
        knowledge: "Order and Payment should be separated.",
        recentHistory: "Payment logic caused coupling.",
        recentThoughts: "Create a specialized payment cell."
      },
      artifactCatalog: [
        {
          artifactId: "artifact-payment",
          type: "code",
          title: "Payment Module",
          goal: "Handle payment",
          outputPaths: ["src/PaymentService.java"],
          languages: ["java"],
          notes: []
        }
      ],
      artifactCatalogErrors: []
    };
  }
}

// 建立 Fake RequesterCell
class FakeRequesterCell {

  constructor(responseOverride = undefined) {
    this.callCount = 0;
    this.lastPrompt = null;
    this.lastTimeout = null;
    this.responseOverride = responseOverride;
  }

  async askWithTimeout(prompt, timeout) {
    this.callCount++;
    this.lastPrompt = prompt;
    this.lastTimeout = timeout;

    if (this.responseOverride !== undefined) {
    return this.responseOverride;
    }

    // 預設回傳合法的 JSON
    return JSON.stringify({
      type: "living-context-division",
      parentCellId: "wrong-parent", // 故意錯誤，測試覆蓋
      childCellId: "wrong-child", // 故意錯誤，測試覆蓋
      revisedParentLivingContext: {
        purpose: "Handle orders",
        responsibilities: ["Order"],
        owns: ["Order"],
        excludes: ["Payment"],
        inputs: [],
        outputs: ["PaymentRequested"],
        constraints: [],
        relationships: [
          {
            type: "uses",
            target: "cell-payment"
          }
        ]
      },
      childLivingContext: {
        purpose: "Handle payments",
        responsibilities: ["Payment"],
        owns: ["Payment"],
        excludes: ["Order"],
        inputs: ["PaymentRequested"],
        outputs: ["PaymentCompleted"],
        constraints: [],
        relationships: [
          {
            type: "serves",
            target: "cell-parent"
          }
        ]
      },
      childMemorySeed: {
        knowledge: "Payment owns payment transaction state.",
        history: "Derived from payment coupling experience.",
        thought: "Specialize payment processing."
      },
      productionPlan: [
        {
          sourceArtifactId: "artifact-payment",
          action: "derive",
          targetCellId: "cell-payment",
          title: "Payment Service",
          reason: "Generate an independent payment service."
        }
      ],
      sharedContracts: [],
      assumptions: []
    });
  }
}

// Test 1: SourceMaterialService 被呼叫一次
await test('SourceMaterialService is called once', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell();
  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  await service.createDivisionPlan({
    parentCell: fakeParent,
    childId: "cell-payment",
    dnaDivisionPlan: fakeDnaDivisionPlan
  });

  assert(fakeSourceService.callCount === 1, 'SourceMaterialService should be called once');
});

// Test 2: askWithTimeout 被呼叫一次
await test('askWithTimeout is called once', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell();
  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  await service.createDivisionPlan({
    parentCell: fakeParent,
    childId: "cell-payment",
    dnaDivisionPlan: fakeDnaDivisionPlan
  });

  assert(fakeRequester.callCount === 1, 'askWithTimeout should be called once');
});

// Test 3: timeout 為 3600000
await test('Timeout is 3600000ms', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell();
  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  await service.createDivisionPlan({
    parentCell: fakeParent,
    childId: "cell-payment",
    dnaDivisionPlan: fakeDnaDivisionPlan
  });

  assert(fakeRequester.lastTimeout === 3600000, 'Timeout should be 3600000ms');
});

// Test 4: Prompt 包含 Parent Cell ID
await test('Prompt includes Parent Cell ID', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell();
  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  await service.createDivisionPlan({
    parentCell: fakeParent,
    childId: "cell-payment",
    dnaDivisionPlan: fakeDnaDivisionPlan
  });

  assert(
    fakeRequester.lastPrompt.includes("cell-parent"),
    'Prompt should include parent cell ID'
  );
});

// Test 5: Prompt 包含 Child ID
await test('Prompt includes Child ID', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell();
  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  await service.createDivisionPlan({
    parentCell: fakeParent,
    childId: "cell-payment",
    dnaDivisionPlan: fakeDnaDivisionPlan
  });

  assert(
    fakeRequester.lastPrompt.includes("cell-payment"),
    'Prompt should include child ID'
  );
});

// Test 6: Prompt 包含 Living Context
await test('Prompt includes Living Context', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell();
  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  await service.createDivisionPlan({
    parentCell: fakeParent,
    childId: "cell-payment",
    dnaDivisionPlan: fakeDnaDivisionPlan
  });

  assert(
    fakeRequester.lastPrompt.includes("Living Context"),
    'Prompt should mention Living Context'
  );
});

// Test 7: Prompt 包含 Artifact Catalog
await test('Prompt includes Artifact Catalog', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell();
  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  await service.createDivisionPlan({
    parentCell: fakeParent,
    childId: "cell-payment",
    dnaDivisionPlan: fakeDnaDivisionPlan
  });

  assert(
    fakeRequester.lastPrompt.includes("artifact-payment"),
    'Prompt should include artifact catalog'
  );
});

// Test 8: AI 回傳錯誤 ID 時，結果仍被覆蓋成正確 ID
await test('AI returned wrong IDs are overridden with correct IDs', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell();
  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  const plan = await service.createDivisionPlan({
    parentCell: fakeParent,
    childId: "cell-payment",
    dnaDivisionPlan: fakeDnaDivisionPlan
  });

  assert(plan.parentCellId === "cell-parent", 'Parent ID should be overridden');
  assert(plan.childCellId === "cell-payment", 'Child ID should be overridden');
  assert(plan.type === "living-context-division", 'Type should be overridden');
});

// Test 9: 合法 Plan 回傳成功
await test('Valid plan is returned successfully', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell();
  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  const plan = await service.createDivisionPlan({
    parentCell: fakeParent,
    childId: "cell-payment",
    dnaDivisionPlan: fakeDnaDivisionPlan
  });

  assert(plan, 'Plan should be returned');
  assert(plan.revisedParentLivingContext, 'Should have revised parent context');
  assert(plan.childLivingContext, 'Should have child context');
  assert(plan.childMemorySeed, 'Should have child memory seed');
});

// Test 10: 不存在的 sourceArtifactId 會失敗
await test('Non-existent sourceArtifactId causes failure', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell(JSON.stringify({
    type: "living-context-division",
    parentCellId: "cell-parent",
    childCellId: "cell-payment",
    revisedParentLivingContext: {
      purpose: "Parent"
    },
    childLivingContext: {
      purpose: "Child"
    },
    childMemorySeed: {
      knowledge: "",
      history: "",
      thought: ""
    },
    productionPlan: [
      {
        sourceArtifactId: "non-existent-artifact",
        action: "derive",
        targetCellId: "cell-payment",
        title: "Service",
        reason: "Create service"
      }
    ]
  }));

  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  let errorThrown = false;
  try {
    await service.createDivisionPlan({
      parentCell: fakeParent,
      childId: "cell-payment",
      dnaDivisionPlan: fakeDnaDivisionPlan
    });
  } catch (error) {
    errorThrown = true;
    assert(
      error.message.includes('non-existent-artifact'),
      'Error should mention the non-existent artifact'
    );
  }

  assert(errorThrown, 'Should throw error for non-existent artifact');
});

// Test 11: AI 回傳 Markdown code fence 仍能解析
await test('Markdown code fence is handled correctly', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell(`\`\`\`json
{
  "type": "living-context-division",
  "parentCellId": "cell-parent",
  "childCellId": "cell-payment",
  "revisedParentLivingContext": {
    "purpose": "Parent"
  },
  "childLivingContext": {
    "purpose": "Child"
  },
  "childMemorySeed": {
    "knowledge": "",
    "history": "",
    "thought": ""
  },
  "productionPlan": []
}
\`\`\``);

  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  const plan = await service.createDivisionPlan({
    parentCell: fakeParent,
    childId: "cell-payment",
    dnaDivisionPlan: fakeDnaDivisionPlan
  });

  assert(plan, 'Should parse JSON with code fence');
  assert(plan.childLivingContext.purpose === "Child", 'Should extract correct data');
});

// Test 12: AI 回傳非 JSON 時失敗
await test('Non-JSON response causes failure', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell("This is not JSON");

  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  let errorThrown = false;
  try {
    await service.createDivisionPlan({
      parentCell: fakeParent,
      childId: "cell-payment",
      dnaDivisionPlan: fakeDnaDivisionPlan
    });
  } catch (error) {
    errorThrown = true;
    assert(
      error.message.includes('failed to parse'),
      'Error should mention parsing failure'
    );
  }

  assert(errorThrown, 'Should throw error for non-JSON response');
});

// Test 13: AI 回傳空 Child Living Context 時失敗
await test('Empty childLivingContext causes failure', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  const fakeRequester = new FakeRequesterCell(JSON.stringify({
    type: "living-context-division",
    parentCellId: "cell-parent",
    childCellId: "cell-payment",
    revisedParentLivingContext: {
      purpose: "Parent"
    },
    childLivingContext: {
      purpose: "",
      responsibilities: [],
      owns: [],
      outputs: []
    },
    childMemorySeed: {
      knowledge: "",
      history: "",
      thought: ""
    }
  }));

  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  let errorThrown = false;
  try {
    await service.createDivisionPlan({
      parentCell: fakeParent,
      childId: "cell-payment",
      dnaDivisionPlan: fakeDnaDivisionPlan
    });
  } catch (error) {
    errorThrown = true;
    assert(
      error.message.includes('invalid division plan'),
      'Error should mention invalid plan'
    );
  }

  assert(errorThrown, 'Should throw error for empty child context');
});

// Test 14: SourceMaterialService 失敗時有明確錯誤
await test('SourceMaterialService failure produces clear error', async () => {
  class FailingSourceService {
    async buildCellSourceMaterial() {
      throw new Error('Source material collection failed');
    }
  }

  const fakeRequester = new FakeRequesterCell();
  const service = new LivingContextService({
    requesterCell: fakeRequester,
    sourceMaterialService: new FailingSourceService()
  });

  const fakeParent = { id: "cell-parent" };
  
  let errorThrown = false;
  try {
    await service.createDivisionPlan({
      parentCell: fakeParent,
      childId: "cell-payment",
      dnaDivisionPlan: fakeDnaDivisionPlan
    });
  } catch (error) {
    errorThrown = true;
    assert(
      error.message.includes('failed to collect source material'),
      'Error should mention source material failure'
    );
    assert(error.cause, 'Error should have cause');
  }

  assert(errorThrown, 'Should throw error when source service fails');
});

// Test 15: askWithTimeout 失敗時保留 cause
await test('askWithTimeout failure preserves cause', async () => {
  const fakeSourceService = new FakeSourceMaterialService();
  
  class FailingRequester {
    async askWithTimeout() {
      throw new Error('AI call failed');
    }
  }

  const service = new LivingContextService({
    requesterCell: new FailingRequester(),
    sourceMaterialService: fakeSourceService
  });

  const fakeParent = { id: "cell-parent" };
  
  let errorThrown = false;
  try {
    await service.createDivisionPlan({
      parentCell: fakeParent,
      childId: "cell-payment",
      dnaDivisionPlan: fakeDnaDivisionPlan
    });
  } catch (error) {
    errorThrown = true;
    assert(
      error.message.includes('AI division planning failed'),
      'Error should mention AI failure'
    );
    assert(error.cause, 'Error should have cause');
    assert(
      error.cause.message.includes('AI call failed'),
      'Cause should be preserved'
    );
  }

  assert(errorThrown, 'Should throw error when AI fails');
});

// Summary
console.log(`\n=== Test Results ===`);
console.log(`Passed: ${passCount}/${testCount}`);
console.log(`Failed: ${testCount - passCount}/${testCount}`);

if (passCount === testCount) {
  console.log('\n✅ All tests passed!');
  process.exit(0);
} else {
  console.log('\n✗ Some tests failed');
  process.exit(1);
}
