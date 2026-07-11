/**
 * living-context-prompts.js
 * 
 * Living Context 相關的 AI Prompt 建構函式
 */

/**
 * 建立 Division Transformation Plan Prompt
 * 
 * @param {Object} options
 * @param {Object} options.parentSource - Parent Cell 的 Source Material
 * @param {Object} options.dnaDivisionPlan - DNA Division Plan
 * @param {string} options.childId - Child Cell ID
 * @returns {string} Prompt 文字
 */
export function buildLivingContextDivisionPrompt({ parentSource, dnaDivisionPlan, childId }) {
  // 參數檢查
  if (!parentSource) {
    throw new Error('parentSource is required');
  }
  if (!parentSource.cellId) {
    throw new Error('parentSource.cellId is required');
  }
  if (!dnaDivisionPlan) {
    throw new Error('dnaDivisionPlan is required');
  }
  if (!childId) {
    throw new Error('childId is required');
  }
  if (childId === parentSource.cellId) {
    throw new Error('childId must not equal parentSource.cellId');
  }

  const parentId = parentSource.cellId;
  const sigma = dnaDivisionPlan.sigma || 0.5;
  
  // 準備資料
  const livingContext = parentSource.livingContext || {};
  const responsibilities = parentSource.responsibilities || [];
  const relationships = parentSource.relationships || [];
  const memory = parentSource.distilledMemory || {};
  const artifactCatalog = parentSource.artifactCatalog || [];

  // 萃取 Memory（只保留關鍵部分，避免 Prompt 過長）
  const distilledMemory = {
    knowledge: memory.knowledge || "",
    recentHistory: memory.recentHistory || memory.history || "",
    recentThoughts: memory.recentThoughts || memory.thought || ""
  };

  // 建立 Prompt
  const prompt = `你是 Cradle 的 Living Context Division Planner。

你的任務不是切割檔案，也不是直接生成程式碼。

你的任務是根據：
1. Parent Cell 的 Living Context
2. Parent Cell 的 Memory
3. Parent Cell 的 Artifact Catalog
4. DNA SVD Division Plan
5. Child 的專化方向

產生一份 Living Context Division Transformation Plan。

# 優先順序

請依照以下優先順序進行分析：

1. **DNA specialization**：DNA Division Plan 定義的專化方向
2. **Living Context boundary**：Living Context 定義的職責與邊界
3. **Distilled Memory**：萃取後的知識與經驗
4. **Artifact Catalog**：現有能力的參考

Artifact Catalog 只能用來：
- 辨識既有能力
- 選擇可能的 sourceArtifactIds

不能假設 Artifact 一定要被使用。

# 規則

請嚴格遵守以下規則：

1. **不可直接複製 Parent 全部 responsibilities 給 Child**
2. **Child 必須有清楚的 purpose**
3. **Parent 與 Child 的責任應有合理分工**
4. **Parent 不應同時保留已轉移給 Child 的主要 ownership**
5. **跨邊界依賴應放進 inputs、outputs、relationships 或 sharedContracts**
6. **childMemorySeed 必須是萃取後的知識，不可整包複製 Parent Memory**
7. **productionPlan 可以是空的**
8. **sourceArtifactIds 只能引用 Artifact Catalog 中存在的 ID**
9. **不可直接生成 Artifact JSON**
10. **不可直接生成程式碼**
11. **只輸出單一 JSON object**
12. **不可使用 Markdown code fence**
13. **不可輸出 JSON 以外文字**
14. revisedParentLivingContext 不可為空；Parent 分裂後仍必須保留明確 purpose 或至少一項 responsibility、ownership、output
15. childMemorySeed.history 必須輸出空字串；Division birth history 將由系統建立，不可複製 Parent history、CLI 指令、User 對話或 AI 回覆

---

# Parent Cell ID

${parentId}

---

# Target Child ID

${childId}

---

# DNA Division Plan

${JSON.stringify(dnaDivisionPlan, null, 2)}

---

# Parent Living Context

${JSON.stringify(livingContext, null, 2)}

---

# Parent Responsibilities

${JSON.stringify(responsibilities, null, 2)}

---

# Parent Relationships

${JSON.stringify(relationships, null, 2)}

---

# Distilled Memory

${JSON.stringify(distilledMemory, null, 2)}

---

# Artifact Catalog

${JSON.stringify(artifactCatalog.map(a => ({
  artifactId: a.artifactId,
  type: a.type,
  title: a.title,
  goal: a.goal,
  outputPaths: a.outputPaths,
  languages: a.languages
})), null, 2)}

---

# Output Schema

請嚴格依照以下 JSON Schema 輸出，不可使用 Markdown code fence，不可輸出任何其他文字：

{
  "type": "living-context-division",
  "parentCellId": "${parentId}",
  "childCellId": "${childId}",
  "revisedParentLivingContext": {
    "purpose": "",
    "responsibilities": [],
    "owns": [],
    "excludes": [],
    "inputs": [],
    "outputs": [],
    "constraints": [],
    "relationships": []
  },
  "childLivingContext": {
    "purpose": "",
    "responsibilities": [],
    "owns": [],
    "excludes": [],
    "inputs": [],
    "outputs": [],
    "constraints": [],
    "relationships": []
  },
  "childMemorySeed": {
    "knowledge": "",
    "history": "",
    "thought": ""
  },
  "productionPlan": [],
  "sharedContracts": [],
  "assumptions": []
}`;

  return prompt;
}
