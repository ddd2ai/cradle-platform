// test-dna-lifecycle.js
// Test DNA lifecycle decision system

import { CradleCell } from "./src/cradle-cell.js";

async function testLifecycleDecision() {
  console.log("\n=== DNA Lifecycle Decision Test ===\n");

  const cell = new CradleCell({ id: "cell-001" });

  try {
    // Test 1: Get lifecycle decision
    console.log("Test 1: Basic Lifecycle Decision");
    console.log("---------------------------------");
    
    const maturity = await cell.getMaturityInfo();
    const lifecycle = await cell.getLifecycleDecision();

    console.log(`Cell ID        : ${cell.id}`);
    console.log(`Action         : ${lifecycle.action}`);
    console.log(`Confidence     : ${lifecycle.confidence}`);
    console.log(`Reason         : ${lifecycle.reason}`);
    console.log("");

    // Test 2: Maturity context
    console.log("Test 2: DNA Maturity Context");
    console.log("-----------------------------");
    console.log(`Maturity       : ${maturity.percent}% (${maturity.state})`);
    console.log(`Sample Size    : ${maturity.sampleSize}`);
    console.log(`Variance       : ${maturity.temporalVariance.toFixed(6)}`);
    console.log(`Convergence    : ${maturity.convergence.toFixed(4)}`);
    console.log(`Magnitude      : ${maturity.normalizedMagnitude.toFixed(4)}`);
    console.log("");

    // Test 3: Decision detail analysis
    console.log("Test 3: Decision Detail");
    console.log("-----------------------");
    const detail = lifecycle.detail ?? {};
    
    for (const [key, value] of Object.entries(detail)) {
      if (typeof value === "number") {
        console.log(`  ${key.padEnd(25)}: ${value.toFixed(6)}`);
      } else if (typeof value === "object" && value !== null) {
        console.log(`  ${key.padEnd(25)}: ${JSON.stringify(value)}`);
      } else {
        console.log(`  ${key.padEnd(25)}: ${value}`);
      }
    }
    console.log("");

    // Test 4: Decision matrix
    console.log("Test 4: Decision Matrix");
    console.log("-----------------------");
    
    const checks = {
      "Sample Size >= 5": {
        pass: maturity.sampleSize >= 5,
        value: maturity.sampleSize,
        threshold: 5,
      },
      "Maturity >= 0.60": {
        pass: maturity.maturity >= 0.60,
        value: maturity.maturity.toFixed(4),
        threshold: 0.60,
      },
      "Maturity >= 0.75 (divide)": {
        pass: maturity.maturity >= 0.75,
        value: maturity.maturity.toFixed(4),
        threshold: 0.75,
      },
      "Variance <= 0.08": {
        pass: maturity.temporalVariance <= 0.08,
        value: maturity.temporalVariance.toFixed(6),
        threshold: 0.08,
      },
      "Variance <= 0.10 (fuse)": {
        pass: maturity.temporalVariance <= 0.10,
        value: maturity.temporalVariance.toFixed(6),
        threshold: 0.10,
      },
      "Magnitude >= 0.60": {
        pass: maturity.normalizedMagnitude >= 0.60,
        value: maturity.normalizedMagnitude.toFixed(4),
        threshold: 0.60,
      },
    };

    for (const [check, result] of Object.entries(checks)) {
      const icon = result.pass ? "✓" : "✗";
      console.log(`  ${icon} ${check.padEnd(30)} ${result.value} (need ${result.threshold})`);
    }
    console.log("");

    // Test 5: Action interpretation
    console.log("Test 5: Action Interpretation");
    console.log("------------------------------");
    
    const interpretations = {
      stay: "Cell should remain stable and continue current activities",
      repair: "Cell needs to stabilize DNA or reduce failure rate",
      divide: "Cell is ready for specialization through division",
      fuse: "Cell is ready to combine with complementary cell",
    };

    console.log(`Action         : ${lifecycle.action}`);
    console.log(`Interpretation : ${interpretations[lifecycle.action] ?? "Unknown"}`);
    console.log(`Next Steps     : ${getNextSteps(lifecycle.action)}`);
    console.log("");

    // Test 6: Trait analysis (if available)
    if (detail.dominantTrait) {
      console.log("Test 6: Trait Analysis");
      console.log("----------------------");
      const dominant = detail.dominantTrait;
      console.log(`Dominant Trait  : ${dominant.trait}`);
      console.log(`Trait Value     : ${dominant.value?.toFixed(4) ?? "N/A"}`);
      console.log(`Dominance Ratio : ${dominant.dominanceRatio?.toFixed(4) ?? "N/A"}`);
      
      if (detail.crossTraitVariance !== undefined) {
        console.log(`Cross-Trait Var : ${detail.crossTraitVariance.toFixed(6)}`);
        
        const specialization = detail.crossTraitVariance >= 0.04 ? "Specialized" : "Generalized";
        console.log(`Specialization  : ${specialization}`);
      }
      console.log("");
    }

    console.log("=== Test Complete ===\n");

  } catch (error) {
    console.error("Error during test:");
    console.error(error.message);
    console.error(error.stack);
  }
}

function getNextSteps(action) {
  const steps = {
    stay: "Continue evolving and gathering DNA history",
    repair: "Run /repair to stabilize DNA or reduce task failures",
    divide: "Run /divide-svd to create specialized child cell",
    fuse: "Run /fuse with complementary cell",
  };
  return steps[action] ?? "Unknown";
}

// Run test
testLifecycleDecision();
