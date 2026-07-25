export function renderDNAHistory(history = []) {
  console.log("");

  if (history.length === 0) {
    console.log("(empty dna history)");
    return;
  }

  history
    .slice(-10)
    .forEach((item, index) => {
      console.log(`[${index + 1}] ${item.at} (${item.reason})`);
    });

  console.log("");
}

export function renderMaturityInfo(maturity) {
  console.log(`
DNA Maturity

Maturity       : ${maturity.percent}%
State          : ${maturity.state}
Sample Size    : ${maturity.sampleSize}
Magnitude      : ${maturity.magnitude.toFixed(4)}
Normalized     : ${maturity.normalizedMagnitude.toFixed(4)}
Variance       : ${maturity.temporalVariance.toFixed(6)}
Convergence    : ${maturity.convergence.toFixed(4)}

Trait Scores:
${Object.entries(maturity.currentTraitScores)
  .map(([trait, value]) => `  ${trait.padEnd(20)}: ${Number(value).toFixed(4)}`)
  .join("\n")}
`);
}

export function renderLifecycleDecision({
  cell,
  maturity,
  decision,
}) {
  console.log(`
Cell Lifecycle Decision

Cell             : ${cell.id}
Action           : ${decision.action}
Confidence       : ${decision.confidence}
Reason           : ${decision.reason}

DNA Maturity
- Maturity        : ${maturity.percent}%
- State           : ${maturity.state}
- Sample Size     : ${maturity.sampleSize}
- Variance        : ${maturity.temporalVariance.toFixed(6)}
- Convergence     : ${maturity.convergence.toFixed(4)}
- Magnitude       : ${maturity.normalizedMagnitude.toFixed(4)}

Lifecycle Detail
${Object.entries(decision.detail ?? {})
  .map(([key, value]) => {
    if (typeof value === "number") {
      return `- ${key.padEnd(25)}: ${value.toFixed(6)}`;
    }

    if (typeof value === "object" && value !== null) {
      return `- ${key.padEnd(25)}: ${JSON.stringify(value)}`;
    }

    return `- ${key.padEnd(25)}: ${value}`;
  })
  .join("\n")}
`);
}
