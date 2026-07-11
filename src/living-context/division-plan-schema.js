import { normalizeLivingContext, validateLivingContext } from './living-context-schema.js';

/**
 * 建立一個 Division Plan 物件
 * @param {Object} input - 輸入資料
 * @returns {Object} Division Plan
 */
export function createDivisionPlan(input = {}) {
  return {
    type: "living-context-division",
    parentCellId: input.parentCellId || "",
    childCellId: input.childCellId || "",
    revisedParentLivingContext: input.revisedParentLivingContext || {},
    childLivingContext: input.childLivingContext || {},
    childMemorySeed: input.childMemorySeed || {
      knowledge: "",
      history: "",
      thought: ""
    },
    productionPlan: input.productionPlan || [],
    sharedContracts: input.sharedContracts || [],
    assumptions: input.assumptions || [],
    createdAt: input.createdAt || new Date().toISOString()
  };
}

/**
 * 正規化 Living Context 規格（不包含系統欄位）
 * @param {Object} spec - Living Context 規格
 * @returns {Object} 正規化後的規格
 */
function normalizeLivingContextSpec(spec) {
  if (!spec || typeof spec !== 'object') {
    return {
      purpose: "",
      responsibilities: [],
      owns: [],
      excludes: [],
      inputs: [],
      outputs: [],
      constraints: [],
      relationships: []
    };
  }

  // 正規化字串
  const trimStr = (val) => typeof val === 'string' ? val.trim() : "";

  // 正規化陣列（去除空字串、trim、去重）
  const normalizeArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    const trimmed = arr
      .map(item => typeof item === 'string' ? item.trim() : item)
      .filter(item => item !== "");
    return [...new Set(trimmed)];
  };

  // 正規化 relationships（依據 type + target 去重）
  const normalizeRelationships = (arr) => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    return arr
      .filter(rel => {
        if (!rel || typeof rel !== 'object') return false;
        if (!rel.type || !rel.target) return false;
        const key = `${rel.type}:${rel.target}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(rel => ({
        type: trimStr(rel.type),
        target: trimStr(rel.target),
        description: trimStr(rel.description || "")
      }));
  };

  return {
    purpose: trimStr(spec.purpose),
    responsibilities: normalizeArray(spec.responsibilities),
    owns: normalizeArray(spec.owns),
    excludes: normalizeArray(spec.excludes),
    inputs: normalizeArray(spec.inputs),
    outputs: normalizeArray(spec.outputs),
    constraints: normalizeArray(spec.constraints),
    relationships: normalizeRelationships(spec.relationships)
  };
}

/**
 * 正規化 Division Plan
 * @param {Object} input - 輸入的 Division Plan
 * @returns {Object} 正規化後的 Division Plan
 */
export function normalizeDivisionPlan(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Division plan input must be an object');
  }

  // 不修改原始 input
  const plan = JSON.parse(JSON.stringify(input));

  // 正規化字串
  const trimStr = (val) => typeof val === 'string' ? val.trim() : "";

  // 正規化 production plan
  const normalizeProductionPlan = (arr) => {
    if (!Array.isArray(arr)) return [];
    
    return arr
      .filter(item => {
        if (!item || typeof item !== 'object') return false;
        // 必須包含 type、title、goal
        return item.type && item.title && item.goal;
      })
      .map(item => {
        // 正規化 sourceArtifactIds
        let sourceArtifactIds = [];
        if (Array.isArray(item.sourceArtifactIds)) {
          sourceArtifactIds = item.sourceArtifactIds
            .map(id => typeof id === 'string' ? id.trim() : "")
            .filter(id => id !== "");
          sourceArtifactIds = [...new Set(sourceArtifactIds)];
        }

        // 正規化 constraints
        let constraints = [];
        if (Array.isArray(item.constraints)) {
          constraints = item.constraints
            .map(c => typeof c === 'string' ? c.trim() : "")
            .filter(c => c !== "");
          constraints = [...new Set(constraints)];
        }

        return {
          type: trimStr(item.type),
          title: trimStr(item.title),
          goal: trimStr(item.goal),
          constraints,
          sourceArtifactIds,
          sourceUsage: trimStr(item.sourceUsage || "reference")
        };
      });
  };

  // 正規化 shared contracts
  const normalizeSharedContracts = (arr) => {
    if (!Array.isArray(arr)) return [];
    
    return arr
      .filter(item => {
        if (!item || typeof item !== 'object') return false;
        return item.name; // 必須包含 name
      })
      .map(item => {
        // 正規化 consumerCellIds
        let consumerCellIds = [];
        if (Array.isArray(item.consumerCellIds)) {
          consumerCellIds = item.consumerCellIds
            .map(id => typeof id === 'string' ? id.trim() : "")
            .filter(id => id !== "");
          consumerCellIds = [...new Set(consumerCellIds)];
        }

        return {
          name: trimStr(item.name),
          ownerCellId: trimStr(item.ownerCellId || ""),
          consumerCellIds,
          description: trimStr(item.description || "")
        };
      });
  };

  // 正規化 assumptions
  const normalizeAssumptions = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(a => typeof a === 'string' ? a.trim() : "")
      .filter(a => a !== "");
  };

  // 正規化 childMemorySeed
  const normalizeMemorySeed = (seed) => {
    if (!seed || typeof seed !== 'object') {
      return {
        knowledge: "",
        history: "",
        thought: ""
      };
    }
    return {
      knowledge: trimStr(seed.knowledge),
      history: trimStr(seed.history),
      thought: trimStr(seed.thought)
    };
  };

  return {
    type: "living-context-division",
    parentCellId: trimStr(plan.parentCellId),
    childCellId: trimStr(plan.childCellId),
    revisedParentLivingContext: normalizeLivingContextSpec(plan.revisedParentLivingContext),
    childLivingContext: normalizeLivingContextSpec(plan.childLivingContext),
    childMemorySeed: normalizeMemorySeed(plan.childMemorySeed),
    productionPlan: normalizeProductionPlan(plan.productionPlan),
    sharedContracts: normalizeSharedContracts(plan.sharedContracts),
    assumptions: normalizeAssumptions(plan.assumptions),
    createdAt: trimStr(plan.createdAt) || new Date().toISOString()
  };
}

/**
 * 驗證 Living Context 規格
 * @param {Object} spec - Living Context 規格
 * @param {string} context - 錯誤訊息前綴
 * @returns {Array} 錯誤訊息陣列
 */
function validateLivingContextSpec(spec, context) {
  const errors = [];

  if (!spec || typeof spec !== 'object') {
    errors.push(`${context} must be an object`);
    return errors;
  }

  // 驗證陣列欄位
  const arrayFields = ['responsibilities', 'owns', 'excludes', 'inputs', 'outputs', 'constraints', 'relationships'];
  for (const field of arrayFields) {
    if (spec[field] !== undefined && !Array.isArray(spec[field])) {
      errors.push(`${context}.${field} must be an array`);
    }
  }

  // 驗證 relationships
  if (Array.isArray(spec.relationships)) {
    spec.relationships.forEach((rel, idx) => {
      if (!rel || typeof rel !== 'object') {
        errors.push(`${context}.relationships[${idx}] must be an object`);
      } else {
        if (!rel.type || typeof rel.type !== 'string') {
          errors.push(`${context}.relationships[${idx}] must have a type`);
        }
        if (!rel.target || typeof rel.target !== 'string') {
          errors.push(`${context}.relationships[${idx}] must have a target`);
        }
      }
    });
  }

  return errors;
}

/**
 * 驗證 Division Plan
 * @param {Object} plan - Division Plan
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateDivisionPlan(plan) {
  const errors = [];

  if (!plan || typeof plan !== 'object') {
    return {
      valid: false,
      errors: ['Division plan must be an object']
    };
  }

  // 驗證 type
  if (plan.type !== "living-context-division") {
    errors.push('type must be "living-context-division"');
  }

  // 驗證 parentCellId
  if (!plan.parentCellId || typeof plan.parentCellId !== 'string' || plan.parentCellId.trim() === "") {
    errors.push('parentCellId must be a non-empty string');
  }

  // 驗證 childCellId
  if (!plan.childCellId || typeof plan.childCellId !== 'string' || plan.childCellId.trim() === "") {
    errors.push('childCellId must be a non-empty string');
  }

  // 驗證 parentCellId 不可等於 childCellId
  if (plan.parentCellId && plan.childCellId && plan.parentCellId === plan.childCellId) {
    errors.push('parentCellId must not equal childCellId');
  }

  // 驗證 revisedParentLivingContext
  errors.push(...validateLivingContextSpec(plan.revisedParentLivingContext, 'revisedParentLivingContext'));

  // 驗證 childLivingContext
  errors.push(...validateLivingContextSpec(plan.childLivingContext, 'childLivingContext'));

  // 驗證 Parent Living Context 不可完全空白
  const parent = plan.revisedParentLivingContext;

  if (parent && typeof parent === "object") {
    const hasPurpose =
      typeof parent.purpose === "string" &&
      parent.purpose.trim() !== "";

    const hasResponsibilities =
      Array.isArray(parent.responsibilities) &&
      parent.responsibilities.length > 0;

    const hasOwns =
      Array.isArray(parent.owns) &&
      parent.owns.length > 0;

    const hasOutputs =
      Array.isArray(parent.outputs) &&
      parent.outputs.length > 0;

    if (
      !hasPurpose &&
      !hasResponsibilities &&
      !hasOwns &&
      !hasOutputs
    ) {
      errors.push(
        "revisedParentLivingContext must have at least one of: purpose, responsibilities, owns, outputs"
      );
    }
  }

  // 驗證 Child Living Context 不可完全空白
  const child = plan.childLivingContext;
  if (child && typeof child === 'object') {
    const hasPurpose = child.purpose && child.purpose.trim() !== "";
    const hasResponsibilities = Array.isArray(child.responsibilities) && child.responsibilities.length > 0;
    const hasOwns = Array.isArray(child.owns) && child.owns.length > 0;
    const hasOutputs = Array.isArray(child.outputs) && child.outputs.length > 0;

    if (!hasPurpose && !hasResponsibilities && !hasOwns && !hasOutputs) {
      errors.push('childLivingContext must have at least one of: purpose, responsibilities, owns, outputs');
    }
  }

  // 驗證 childMemorySeed
  if (!plan.childMemorySeed || typeof plan.childMemorySeed !== 'object') {
    errors.push('childMemorySeed must be an object');
  } else {
    const seed = plan.childMemorySeed;
    if (typeof seed.knowledge !== 'string') {
      errors.push('childMemorySeed.knowledge must be a string');
    }
    if (typeof seed.history !== 'string') {
      errors.push('childMemorySeed.history must be a string');
    }
    if (typeof seed.thought !== 'string') {
      errors.push('childMemorySeed.thought must be a string');
    }
  }

  // 驗證 productionPlan
  if (!Array.isArray(plan.productionPlan)) {
    errors.push('productionPlan must be an array');
  } else {
    plan.productionPlan.forEach((item, idx) => {
      if (!item || typeof item !== 'object') {
        errors.push(`productionPlan[${idx}] must be an object`);
        return;
      }

      if (!item.type || typeof item.type !== 'string' || item.type.trim() === "") {
        errors.push(`productionPlan[${idx}].type must be a non-empty string`);
      }

      if (!item.title || typeof item.title !== 'string' || item.title.trim() === "") {
        errors.push(`productionPlan[${idx}].title must be a non-empty string`);
      }

      if (!item.goal || typeof item.goal !== 'string' || item.goal.trim() === "") {
        errors.push(`productionPlan[${idx}].goal must be a non-empty string`);
      }

      if (!Array.isArray(item.constraints)) {
        errors.push(`productionPlan[${idx}].constraints must be an array`);
      }

      if (!Array.isArray(item.sourceArtifactIds)) {
        errors.push(`productionPlan[${idx}].sourceArtifactIds must be an array`);
      }

      // 驗證 sourceUsage
      const validUsages = ['reference', 'behavior-reference', 'contract-reference'];
      if (item.sourceUsage && !validUsages.includes(item.sourceUsage)) {
        errors.push(`productionPlan[${idx}].sourceUsage must be one of: ${validUsages.join(', ')}`);
      }
    });
  }

  // 驗證 sharedContracts
  if (!Array.isArray(plan.sharedContracts)) {
    errors.push('sharedContracts must be an array');
  } else {
    plan.sharedContracts.forEach((item, idx) => {
      if (!item || typeof item !== 'object') {
        errors.push(`sharedContracts[${idx}] must be an object`);
        return;
      }

      if (!item.name || typeof item.name !== 'string' || item.name.trim() === "") {
        errors.push(`sharedContracts[${idx}].name must be a non-empty string`);
      }

      if (!item.ownerCellId || typeof item.ownerCellId !== 'string' || item.ownerCellId.trim() === "") {
        errors.push(`sharedContracts[${idx}].ownerCellId must be a non-empty string`);
      }

      if (!Array.isArray(item.consumerCellIds)) {
        errors.push(`sharedContracts[${idx}].consumerCellIds must be an array`);
      }

      if (typeof item.description !== 'string') {
        errors.push(`sharedContracts[${idx}].description must be a string`);
      }

      // 驗證 ownerCellId 必須等於 parentCellId 或 childCellId
      if (item.ownerCellId && plan.parentCellId && plan.childCellId) {
        if (item.ownerCellId !== plan.parentCellId && item.ownerCellId !== plan.childCellId) {
          errors.push(`sharedContracts[${idx}].ownerCellId must be either parentCellId or childCellId`);
        }
      }
    });
  }

  // 驗證 assumptions
  if (!Array.isArray(plan.assumptions)) {
    errors.push('assumptions must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
