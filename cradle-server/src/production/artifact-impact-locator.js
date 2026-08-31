import path from "node:path";

const MAX_TARGETS = 3;

export function locateArtifactChangeTargets({ artifact, task, executionResult } = {}) {
  const outputs = (artifact?.outputs ?? []).filter(
    (output) => output?.kind === "file" && output.path
  );
  if (outputs.length === 0) {
    return { paths: [], confidence: 0, reason: "artifact has no file outputs" };
  }

  const evidence = buildEvidenceText(task, executionResult);
  const diagnosticPaths = extractDiagnosticPaths(evidence);
  const scored = outputs.map((output) => {
    const outputPath = normalize(output.path);
    const basename = path.posix.basename(outputPath);
    const stem = basename.replace(/\.[^.]+$/, "");
    let score = 0;

    if (diagnosticPaths.some((candidate) => pathsMatch(outputPath, candidate))) score += 20;
    if (evidence.includes(outputPath.toLowerCase())) score += 12;
    if (evidence.includes(basename.toLowerCase())) score += 8;
    if (stem.length >= 4 && evidence.includes(stem.toLowerCase())) score += 4;

    for (const symbol of extractDeclaredSymbols(output.content)) {
      if (symbol.length >= 4 && evidence.includes(symbol.toLowerCase())) score += 3;
    }
    return { path: output.path, score };
  });

  const matched = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  if (matched.length > 0) {
    const topScore = matched[0].score;
    const paths = matched
      .filter((item) => item.score >= Math.max(4, topScore - 3))
      .slice(0, MAX_TARGETS)
      .map((item) => item.path);
    return {
      paths,
      confidence: Math.min(1, topScore / 20),
      reason: diagnosticPaths.length > 0
        ? "execution diagnostic matched artifact output"
        : "task or execution evidence matched artifact output",
    };
  }

  if (outputs.length === 1) {
    return {
      paths: [outputs[0].path],
      confidence: 0.5,
      reason: "single-output artifact has an unambiguous repair boundary",
    };
  }

  return {
    paths: [],
    confidence: 0,
    reason: "no deterministic output target could be located",
  };
}

function buildEvidenceText(task, executionResult) {
  return [
    task?.title,
    task?.content,
    executionResult?.status,
    executionResult?.command,
    executionResult?.stderr,
    executionResult?.stdout,
    executionResult?.error,
  ].filter(Boolean).join("\n").toLowerCase();
}

function extractDiagnosticPaths(text) {
  const paths = [];
  const pattern = /([a-z0-9_./\\-]+\.[a-z0-9]+)(?::\[?\d+(?:,\d+)?\]?|\(\d+(?:,\d+)?\))/gi;
  for (const match of text.matchAll(pattern)) {
    paths.push(normalize(match[1]));
  }
  return paths;
}

function extractDeclaredSymbols(content = "") {
  const symbols = [];
  const pattern = /\b(?:class|interface|record|function|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of String(content).matchAll(pattern)) symbols.push(match[1]);
  return symbols;
}

function pathsMatch(outputPath, diagnosticPath) {
  return outputPath === diagnosticPath ||
    outputPath.endsWith(`/${diagnosticPath}`) ||
    diagnosticPath.endsWith(`/${outputPath}`);
}

function normalize(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "").toLowerCase();
}
