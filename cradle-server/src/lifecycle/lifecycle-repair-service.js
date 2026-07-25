/**
 * Lifecycle Repair Service
 *
 * 負責執行 Cell 生命週期的修復操作。
 * 不同的 repair type 會導向不同的修復策略。
 */

import {
  resolveRepairTypeFromPlan,
} from "./repair-type.js";

/**
 * 執行生命週期修復
 *
 * @param {CradleCell} cell - Cell 實例
 * @param {CradleEngine} engine - Engine 實例
 * @param {Object} plan - Lifecycle plan
 * @param {Object} options - 選項
 * @param {string} options.artifactId - Artifact ID（用於 artifact repair）
 * @param {number} options.maxRounds - 最大修復回合數
 * @returns {Promise<Object>} Repair result
 */
export async function executeLifecycleRepair(cell, engine, plan, options = {}) {
  const repairType = resolveRepairType(plan);

  if (repairType === "artifact") {
    return await repairArtifact(cell, engine, plan, options);
  }

  if (repairType === "dna") {
    return await repairDNA(cell, engine, plan, options);
  }

  if (repairType === "environment") {
    return await repairEnvironment(cell, engine, plan, options);
  }

  return {
    repaired: false,
    repairType,
    reason: "no executable repair strategy found",
    suggestion: "repair type not yet implemented",
    plan,
  };
}

/**
 * 判斷需要哪種類型的修復
 *
 * 根據 decision detail 判斷：
 * - recentFailureRate > 0.30 → artifact repair
 * - temporalVariance > 0.20 → dna repair
 * - 其他 → unknown
 *
 * @param {Object} plan - Lifecycle plan
 * @returns {string} Repair type
 */
export function resolveRepairType(plan) {
  return resolveRepairTypeFromPlan(plan);
}

/**
 * 執行 Artifact 修復
 *
 * 呼叫 Cell 的 stabilizeArtifact() 方法。
 * 如果沒有提供 artifactId，會安全返回而不執行。
 *
 * @param {CradleCell} cell - Cell 實例
 * @param {CradleEngine} engine - Engine 實例
 * @param {Object} plan - Lifecycle plan
 * @param {Object} options - 選項
 * @returns {Promise<Object>} Repair result
 */
async function repairArtifact(cell, engine, plan, options = {}) {
  const artifactId =
    options.artifactId ??
    plan?.decision?.detail?.artifactId ??
    null;

  if (!artifactId) {
    return {
      repaired: false,
      repairType: "artifact",
      reason: "artifact repair requires artifactId",
      suggestion: "run /lifecycle-run --apply <artifact-id>",
      plan,
    };
  }

  const maxRounds = options.maxRounds ?? 3;

  try {
    const result = await cell.stabilizeArtifact({
      artifactId,
      maxRounds,
    });

    return {
      repaired: true,
      repairType: "artifact",
      artifactId,
      maxRounds,
      result,
      reason: "artifact stabilization executed",
      plan,
    };
  } catch (error) {
    return {
      repaired: false,
      repairType: "artifact",
      artifactId,
      error: error.message,
      reason: "artifact stabilization failed",
      plan,
    };
  }
}

/**
 * 執行 DNA 修復（未實作）
 *
 * 未來可以實作：
 * - 回溯到穩定的 DNA 狀態
 * - 重新訓練 DNA
 * - 平滑 DNA 向量
 *
 * @param {CradleCell} cell - Cell 實例
 * @param {CradleEngine} engine - Engine 實例
 * @param {Object} plan - Lifecycle plan
 * @param {Object} options - 選項
 * @returns {Promise<Object>} Repair result
 */
async function repairDNA(cell, engine, plan, options = {}) {
  return {
    repaired: false,
    repairType: "dna",
    reason: "dna repair not yet implemented",
    suggestion: "dna repair strategy is under development",
    plan,
  };
}

/**
 * 執行環境修復（未實作）
 *
 * 未來可以實作：
 * - 重置環境設定
 * - 清理暫存檔案
 * - 修復檔案權限
 *
 * @param {CradleCell} cell - Cell 實例
 * @param {CradleEngine} engine - Engine 實例
 * @param {Object} plan - Lifecycle plan
 * @param {Object} options - 選項
 * @returns {Promise<Object>} Repair result
 */
async function repairEnvironment(cell, engine, plan, options = {}) {
  return {
    repaired: false,
    repairType: "environment",
    reason: "environment repair not yet implemented",
    suggestion: "environment repair strategy is under development",
    plan,
  };
}
