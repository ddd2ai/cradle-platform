const MAX_TARGET_CELLS = 3;
const MIN_RELEVANCE = 0.12;

export function rankStimulusRelevance({ stimulus, cells = [], explicitCellId = null } = {}) {
  if (explicitCellId) {
    return cells
      .filter((cell) => cell.cellId === explicitCellId)
      .map((cell) => ({ cellId: cell.cellId, relevance: 1, reason: "explicit user target" }));
  }

  const stimulusTerms = termsFor([
    stimulus?.summary,
    stimulus?.content,
    stimulus?.facts?.sourceName,
  ]);
  return cells.map((cell) => {
    const cellTerms = termsFor([
      cell.cellId,
      cell.name,
      cell.purpose,
      ...(cell.responsibilities ?? []),
      ...(cell.owns ?? []),
      ...(cell.inputs ?? []),
      ...(cell.outputs ?? []),
      ...(cell.artifacts ?? []).flatMap((artifact) => [artifact.title, artifact.goal, ...(artifact.outputPaths ?? [])]),
    ]);
    const matches = [...stimulusTerms].filter((term) => cellTerms.has(term));
    const denominator = Math.max(6, Math.min(stimulusTerms.size, cellTerms.size));
    const relevance = clamp(matches.length / denominator);
    return {
      cellId: cell.cellId,
      relevance,
      reason: matches.length > 0
        ? `matched ${matches.slice(0, 5).join(", ")}`
        : "no deterministic context match",
    };
  }).sort((a, b) => b.relevance - a.relevance || a.cellId.localeCompare(b.cellId));
}

export function selectStimulusTargets(input = {}) {
  const ranked = rankStimulusRelevance(input);
  if (input.explicitCellId) {
    return ranked.length === 1
      ? { decision: "routed", targets: ranked, needsAttention: false }
      : { decision: "needs-attention", targets: [], needsAttention: true, reason: "explicit Cell was not found" };
  }

  const relevant = ranked.filter((candidate) => candidate.relevance >= MIN_RELEVANCE);
  if (relevant.length > 0) {
    const highest = relevant[0].relevance;
    return {
      decision: "routed",
      targets: relevant
        .filter((candidate) => candidate.relevance >= Math.max(MIN_RELEVANCE, highest - 0.15))
        .slice(0, MAX_TARGET_CELLS),
      needsAttention: false,
    };
  }
  if (ranked.length === 1) {
    return {
      decision: "routed",
      targets: [{ ...ranked[0], reason: "only available Cell" }],
      needsAttention: false,
    };
  }
  return {
    decision: "needs-attention",
    targets: [],
    needsAttention: true,
    reason: "no Cell has enough reproducible relevance evidence",
  };
}

function termsFor(values) {
  const terms = new Set();
  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  for (const value of values.flat(Infinity)) {
    const text = String(value ?? "").toLowerCase();
    for (const segment of segmenter.segment(text)) {
      const term = segment.segment.replace(/^[_-]+|[_-]+$/g, "");
      if (segment.isWordLike && term.length >= 2) terms.add(term);
    }
  }
  return terms;
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}
