/**
 * Fusion Plan Schema
 * 
 * 定義 Cell Fusion 的計畫結構、正規化與驗證規則。
 */

export const CAPABILITY_RESOLUTION_STRATEGIES = [
  "inherit",
  "synthesize",
  "replace",
  "discard",
  "contract",
];

export const FUSION_SOURCE_USAGES = [
  "reference",
  "behavior-reference",
  "contract-reference",
];

/**
 * 建立 Fusion Plan
 * @param {object} input
 * @returns {object} fusion plan
 */
export function createFusionPlan(input = {}) {
  return {
    type: "living-context-fusion",
    parentCellIds: input.parentCellIds || [],
    childCellId: input.childCellId || "",
    
    fusedLivingContext: input.fusedLivingContext || {},
    fusedMemorySeed: input.fusedMemorySeed || {
      knowledge: "",
      history: "",
      thought: ""
    },
    
    capabilityResolutions: input.capabilityResolutions || [],
    knowledgeConflicts: input.knowledgeConflicts || [],
    productionPlan: input.productionPlan || [],
    
    assumptions: input.assumptions || [],
    createdAt: input.createdAt || new Date().toISOString()
  };
}

/**
 * 正規化 Fusion Plan
 * 不修改 input，回傳新物件
 * @param {object} input
 * @returns {object} normalized fusion plan
 */
export function normalizeFusionPlan(input) {
  if (!input || typeof input !== "object") {
    return createFusionPlan();
  }
  
  const normalized = {
    type: "living-context-fusion",
    
    parentCellIds: normalizeParentIds(input.parentCellIds),
    childCellId: normalizeString(input.childCellId),
    
    fusedLivingContext: normalizeFusedLivingContext(input.fusedLivingContext),
    fusedMemorySeed: normalizeMemorySeed(input.fusedMemorySeed),
    
    capabilityResolutions: normalizeCapabilities(input.capabilityResolutions),
    knowledgeConflicts: normalizeConflicts(input.knowledgeConflicts),
    productionPlan: normalizeProductionPlan(input.productionPlan),
    
    assumptions: normalizeStringArray(input.assumptions),
    createdAt: input.createdAt || new Date().toISOString()
  };
  
  return normalized;
}

/**
 * 驗證 Fusion Plan
 * @param {object} plan
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateFusionPlan(plan) {
  const errors = [];
  
  if (!plan || typeof plan !== "object") {
    errors.push("Fusion plan must be an object");
    return { valid: false, errors };
  }
  
  // Root 驗證
  if (plan.type !== "living-context-fusion") {
    errors.push("type must be 'living-context-fusion'");
  }
  
  if (!Array.isArray(plan.parentCellIds) || plan.parentCellIds.length < 2) {
    errors.push("parentCellIds must have at least 2 items");
  }
  
  if (typeof plan.childCellId !== "string" || plan.childCellId.trim() === "") {
    errors.push("childCellId must be a non-empty string");
  }
  
  if (Array.isArray(plan.parentCellIds) && plan.parentCellIds.length > 0) {
    const unique = new Set(plan.parentCellIds);
    if (unique.size !== plan.parentCellIds.length) {
      errors.push("parentCellIds must not contain duplicates");
    }
    
    if (plan.parentCellIds.includes(plan.childCellId)) {
      errors.push("parentCellIds must not contain childCellId");
    }
  }
  
  // Fused Living Context 驗證
  validateFusedLivingContext(plan.fusedLivingContext, errors);
  
  // Memory 驗證
  validateMemorySeed(plan.fusedMemorySeed, errors);
  
  // Capability Resolution 驗證
  validateCapabilityResolutions(plan.capabilityResolutions, errors);
  
  // Knowledge Conflict 驗證
  validateKnowledgeConflicts(plan.knowledgeConflicts, errors);
  
  // Production Plan 驗證
  validateProductionPlan(plan.productionPlan, errors);
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================
// Normalize Helpers
// ============================================================

function normalizeString(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  
  const trimmed = value
    .filter(item => typeof item === "string")
    .map(item => item.trim())
    .filter(item => item !== "");
  
  return [...new Set(trimmed)];
}

function normalizeParentIds(value) {
  const normalized = normalizeStringArray(value);
  
  // 保留至少兩個
  if (normalized.length < 2 && Array.isArray(value) && value.length >= 2) {
    // 盡可能保留原始順序
    const filtered = value
      .filter(item => typeof item === "string" && item.trim() !== "")
      .slice(0, 2)
      .map(item => item.trim());
    
    return [...new Set(filtered)];
  }
  
  return normalized;
}

function normalizeFusedLivingContext(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  
  return {
    purpose: normalizeString(value.purpose),
    responsibilities: normalizeStringArray(value.responsibilities),
    owns: normalizeStringArray(value.owns),
    excludes: normalizeStringArray(value.excludes),
    inputs: normalizeStringArray(value.inputs),
    outputs: normalizeStringArray(value.outputs),
    constraints: normalizeStringArray(value.constraints),
    relationships: normalizeRelationships(value.relationships)
  };
}

function normalizeRelationships(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  
  return value
    .filter(rel => rel && typeof rel === "object")
    .filter(rel => rel.type && rel.target)
    .map(rel => ({
      type: normalizeString(rel.type),
      target: normalizeString(rel.target)
    }))
    .filter(rel => rel.type && rel.target);
}

function normalizeMemorySeed(value) {
  if (!value || typeof value !== "object") {
    return {
      knowledge: "",
      history: "",
      thought: ""
    };
  }
  
  return {
    knowledge: normalizeString(value.knowledge),
    history: normalizeString(value.history),
    thought: normalizeString(value.thought)
  };
}

function normalizeCapabilities(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  
  return value
    .filter(cap => cap && typeof cap === "object")
    .filter(cap => cap.capability) // 過濾缺少 capability 的項目
    .map(cap => ({
      capability: normalizeString(cap.capability),
      sourceCellIds: normalizeStringArray(cap.sourceCellIds),
      strategy: normalizeString(cap.strategy),
      resolution: normalizeString(cap.resolution)
    }))
    .filter(cap => cap.capability);
}

function normalizeConflicts(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  
  return value
    .filter(conflict => conflict && typeof conflict === "object")
    .filter(conflict => conflict.topic) // 過濾缺少 topic 的項目
    .map(conflict => ({
      topic: normalizeString(conflict.topic),
      views: normalizeViews(conflict.views),
      resolution: normalizeString(conflict.resolution)
    }))
    .filter(conflict => conflict.topic);
}

function normalizeViews(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  
  return value
    .filter(view => view && typeof view === "object")
    .filter(view => view.cellId && view.view)
    .map(view => ({
      cellId: normalizeString(view.cellId),
      view: normalizeString(view.view)
    }))
    .filter(view => view.cellId && view.view);
}

function normalizeProductionPlan(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  
  return value
    .filter(item => item && typeof item === "object")
    .map(item => ({
      type: normalizeString(item.type),
      title: normalizeString(item.title),
      goal: normalizeString(item.goal),
      constraints: normalizeStringArray(item.constraints),
      sourceArtifacts: normalizeSourceArtifacts(item.sourceArtifacts),
      sourceUsage: normalizeString(item.sourceUsage) || "reference"
    }));
}

function normalizeSourceArtifacts(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  
  // 以 cellId + artifactId 去重
  const seen = new Set();
  const result = [];
  
  for (const artifact of value) {
    if (!artifact || typeof artifact !== "object") {
      continue;
    }
    
    const cellId = normalizeString(artifact.cellId);
    const artifactId = normalizeString(artifact.artifactId);
    
    if (!cellId || !artifactId) {
      continue;
    }
    
    const key = `${cellId}/${artifactId}`;
    if (seen.has(key)) {
      continue;
    }
    
    seen.add(key);
    result.push({ cellId, artifactId });
  }
  
  return result;
}

// ============================================================
// Validate Helpers
// ============================================================

function validateFusedLivingContext(context, errors) {
  if (!context || typeof context !== "object") {
    errors.push("fusedLivingContext must be an object");
    return;
  }
  
  const hasContent = 
    (context.purpose && context.purpose.trim()) ||
    (Array.isArray(context.responsibilities) && context.responsibilities.length > 0) ||
    (Array.isArray(context.owns) && context.owns.length > 0) ||
    (Array.isArray(context.outputs) && context.outputs.length > 0);
  
  if (!hasContent) {
    errors.push("fusedLivingContext must have at least one of: purpose, responsibilities, owns, outputs");
  }
  
  // 驗證陣列欄位型別
  const arrayFields = ["responsibilities", "owns", "excludes", "inputs", "outputs", "constraints", "relationships"];
  
  for (const field of arrayFields) {
    if (context[field] !== undefined && !Array.isArray(context[field])) {
      errors.push(`fusedLivingContext.${field} must be an array`);
    }
  }
  
  // 驗證 relationships
  if (Array.isArray(context.relationships)) {
    context.relationships.forEach((rel, index) => {
      if (!rel || typeof rel !== "object") {
        errors.push(`fusedLivingContext.relationships[${index}] must be an object`);
        return;
      }
      
      if (!rel.type || typeof rel.type !== "string" || rel.type.trim() === "") {
        errors.push(`fusedLivingContext.relationships[${index}] must have type`);
      }
      
      if (!rel.target || typeof rel.target !== "string" || rel.target.trim() === "") {
        errors.push(`fusedLivingContext.relationships[${index}] must have target`);
      }
    });
  }
}

function validateMemorySeed(memory, errors) {
  if (!memory || typeof memory !== "object") {
    errors.push("fusedMemorySeed must be an object");
    return;
  }
  
  const fields = ["knowledge", "history", "thought"];
  
  for (const field of fields) {
    if (memory[field] !== undefined && typeof memory[field] !== "string") {
      errors.push(`fusedMemorySeed.${field} must be a string`);
    }
  }
}

function validateCapabilityResolutions(capabilities, errors) {
  if (!Array.isArray(capabilities)) {
    return; // Optional field
  }
  
  const validStrategies = CAPABILITY_RESOLUTION_STRATEGIES;
  
  capabilities.forEach((cap, index) => {
    if (!cap || typeof cap !== "object") {
      return;
    }
    
    if (cap.strategy && !validStrategies.includes(cap.strategy)) {
      errors.push(`capabilityResolutions[${index}].strategy must be one of: ${validStrategies.join(", ")}`);
    }
  });
}

function validateKnowledgeConflicts(conflicts, errors) {
  if (!Array.isArray(conflicts)) {
    return; // Optional field
  }
  
  conflicts.forEach((conflict, index) => {
    if (!conflict || typeof conflict !== "object") {
      return;
    }
    
    if (!conflict.topic || typeof conflict.topic !== "string" || conflict.topic.trim() === "") {
      errors.push(`knowledgeConflicts[${index}] must have topic`);
    }
    
    if (!Array.isArray(conflict.views)) {
      errors.push(`knowledgeConflicts[${index}].views must be an array`);
    } else if (conflict.views.length < 2) {
      errors.push(`knowledgeConflicts[${index}].views must have at least 2 items`);
    } else {
      conflict.views.forEach((view, vIndex) => {
        if (!view || typeof view !== "object") {
          errors.push(`knowledgeConflicts[${index}].views[${vIndex}] must be an object`);
          return;
        }
        
        if (!view.cellId || typeof view.cellId !== "string") {
          errors.push(`knowledgeConflicts[${index}].views[${vIndex}] must have cellId`);
        }
        
        if (!view.view || typeof view.view !== "string") {
          errors.push(`knowledgeConflicts[${index}].views[${vIndex}] must have view`);
        }
      });
    }
    
    if (conflict.resolution !== undefined && typeof conflict.resolution !== "string") {
      errors.push(`knowledgeConflicts[${index}].resolution must be a string`);
    }
  });
}

function validateProductionPlan(plan, errors) {
  if (!Array.isArray(plan)) {
    return; // productionPlan 可以為空
  }
  
  const validUsages = FUSION_SOURCE_USAGES;
  
  plan.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }
    
    if (!item.type || typeof item.type !== "string" || item.type.trim() === "") {
      errors.push(`productionPlan[${index}] must have type`);
    }
    
    if (!item.title || typeof item.title !== "string" || item.title.trim() === "") {
      errors.push(`productionPlan[${index}] must have title`);
    }
    
    if (!item.goal || typeof item.goal !== "string" || item.goal.trim() === "") {
      errors.push(`productionPlan[${index}] must have goal`);
    }
    
    if (item.constraints !== undefined && !Array.isArray(item.constraints)) {
      errors.push(`productionPlan[${index}].constraints must be an array`);
    }
    
    if (item.sourceArtifacts !== undefined && !Array.isArray(item.sourceArtifacts)) {
      errors.push(`productionPlan[${index}].sourceArtifacts must be an array`);
    } else if (Array.isArray(item.sourceArtifacts)) {
      item.sourceArtifacts.forEach((artifact, aIndex) => {
        if (!artifact || typeof artifact !== "object") {
          errors.push(`productionPlan[${index}].sourceArtifacts[${aIndex}] must be an object`);
          return;
        }
        
        if (!artifact.cellId || typeof artifact.cellId !== "string") {
          errors.push(`productionPlan[${index}].sourceArtifacts[${aIndex}] must have cellId`);
        }
        
        if (!artifact.artifactId || typeof artifact.artifactId !== "string") {
          errors.push(`productionPlan[${index}].sourceArtifacts[${aIndex}] must have artifactId`);
        }
      });
    }
    
    if (item.sourceUsage && !validUsages.includes(item.sourceUsage)) {
      errors.push(`productionPlan[${index}].sourceUsage must be one of: ${validUsages.join(", ")}`);
    }
  });
}
