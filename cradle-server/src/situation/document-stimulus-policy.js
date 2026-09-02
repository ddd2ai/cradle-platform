const ACTION_PATTERN = /\b(change|update|repair|replace|remove|add|implement|migrate|must|requirement|bug|fail(?:ed|ure)?|error|security|conflict|breaking)\b|修改|修正|更新|新增|移除|需求|錯誤|失敗|衝突|安全/iu;
const RISK_PATTERN = /\b(security|vulnerability|destructive|data loss|critical|corrupt|breach|fail(?:ed|ure)?|conflict)\b|資安|漏洞|破壞|資料遺失|嚴重|失敗|衝突/iu;
const NEGATED_ACTION_PATTERN = /不(?:需要|要求|必須)?(?:進行)?(?:任何)?(?:修改|修正|更新|變更|新增|移除)|無(?:需|須)?(?:進行)?(?:任何)?(?:修改|修正|更新|變更)|\b(?:no changes? required|does not require (?:a )?(?:change|update|repair)|do not (?:change|update|modify))\b/giu;

export function evaluateDocumentStimulus({ source, extraction, relevance = 0 } = {}) {
  const text = String(extraction?.text ?? "");
  if (extraction?.evidence?.outcome !== "sufficient") {
    return {
      decision: "needs-attention",
      activate: false,
      evolveArtifact: false,
      score: 0,
      salience: { risk: 0.1, novelty: 0.8, stateImpact: 0, urgency: 0.2 },
      reason: extraction?.evidence?.reason ?? "source content has insufficient extraction evidence",
    };
  }

  // A reference note such as "不要求修改" must not wake an LLM merely because
  // its negated phrase contains the token "修改". Preserve prohibitions such as
  // "不得移除" because those are real constraints, not negated requests.
  const decisionText = text.replace(NEGATED_ACTION_PATTERN, "");
  const hasAction = ACTION_PATTERN.test(decisionText);
  const hasRisk = RISK_PATTERN.test(decisionText);
  const stateImpact = hasAction ? 0.8 : text.length >= 120 ? 0.45 : 0.2;
  const risk = hasRisk ? 0.85 : 0.1;
  const urgency = hasRisk ? 0.8 : hasAction ? 0.55 : 0.25;
  const novelty = 0.8;
  const score = clamp(
    relevance * 0.4 + stateImpact * 0.3 + risk * 0.2 + urgency * 0.1
  );

  return {
    decision: score >= 0.55 ? "cultivate" : "summary-only",
    activate: score >= 0.55,
    evolveArtifact: score >= 0.68 && stateImpact >= 0.7,
    score,
    salience: { risk, novelty, stateImpact, urgency },
    reason: hasAction
      ? "source contains an actionable state-change signal"
      : "source can be recorded without full cultivation",
    sourceId: source?.sourceId ?? null,
  };
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}
