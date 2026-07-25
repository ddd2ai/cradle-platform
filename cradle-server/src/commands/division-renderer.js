export function renderDivisionReadiness({
  parent,
  childId,
  maturity,
  decision,
}) {
  console.log(`
        🧬 Division Readiness

        Parent           : ${parent.id}
        Child            : ${childId}
        Maturity         : ${maturity.percent}%
        State            : ${maturity.state}
        Sample Size      : ${maturity.sampleSize}
        Magnitude        : ${maturity.normalizedMagnitude.toFixed(4)}
        Variance         : ${maturity.temporalVariance.toFixed(6)}
        Convergence      : ${maturity.convergence.toFixed(4)}
        Lifecycle Action : ${decision.action}
        Reason           : ${decision.reason}
        `);
}

export function renderDivisionBeforeChildFailure(result) {
  console.log("");
  console.log("❌ Division failed before child creation");

  for (const error of result.errors ?? []) {
    console.log(`- ${error.stage}: ${error.message}`);
  }

  console.log("");
}

export function renderDivisionResult({
  parent,
  result,
}) {
  const {
    child,
    dnaDivisionPlan,
    livingContextPlan,
    productionResult,
    complete,
  } = result;

  console.log(``);
  console.log(`🧬 Living Context Division Complete`);
  console.log(``);
  console.log(`Parent        : ${parent.id}`);
  console.log(`Child         : ${child.id}`);
  console.log(`Role          : ${dnaDivisionPlan.role}`);
  console.log(`Purpose       : ${livingContextPlan.childLivingContext.purpose || "N/A"}`);
  console.log(``);

  renderDivisionProductionResult(productionResult);
  renderDivisionLivingContextSummary(livingContextPlan);

  console.log(`Status        : ${resolveDivisionStatus(result)}`);
  console.log(``);

  if (!complete) {
    renderDivisionWarnings(result);
  }
}

function renderDivisionProductionResult(productionResult) {
  if (!productionResult) {
    return;
  }

  const parentRevisions = productionResult.parentRevisions || [];
  const planned =
    productionResult.produced.length +
    parentRevisions.length +
    productionResult.failed.length;

  console.log(`Production`);
  console.log(`Planned       : ${planned}`);
  console.log(`Child Produced: ${productionResult.produced.length}`);
  console.log(`Parent Revised: ${parentRevisions.length}`);
  console.log(`Failed        : ${productionResult.failed.length}`);
  console.log(``);

  if (productionResult.produced.length > 0) {
    console.log(`Child Artifacts`);
    productionResult.produced.forEach(item => {
      console.log(`- ${item.artifactId.substring(0, 20)}... ${item.title}`);
    });
    console.log(``);
  }

  if (parentRevisions.length > 0) {
    console.log(`Parent Revised Artifacts`);
    parentRevisions.forEach(item => {
      console.log(`- ${item.artifactId.substring(0, 20)}... ${item.title}`);
    });
    console.log(``);
  }
}

function renderDivisionLivingContextSummary(livingContextPlan) {
  console.log(`--- Parent Living Context ---`);
  console.log(`Responsibilities: ${(livingContextPlan.revisedParentLivingContext.responsibilities || []).join(", ")}`);
  console.log(``);

  console.log(`--- Child Living Context ---`);
  console.log(`Responsibilities: ${(livingContextPlan.childLivingContext.responsibilities || []).join(", ")}`);
  console.log(``);
}

function resolveDivisionStatus({ complete, productionResult }) {
  if (!complete) {
    return "incomplete";
  }

  if (productionResult && !productionResult.complete) {
    return "production-incomplete";
  }

  return "complete";
}

function renderDivisionWarnings(result) {
  console.log(`⚠️ Warning: Division application had errors`);
  result.errors.forEach(err => {
    console.log(`  - ${err.stage}: ${err.message}`);
  });
  console.log(``);
}
