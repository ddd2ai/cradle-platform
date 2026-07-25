// test-dna-maturity.js
// Test the new DNA maturity calculation model

import { CradleCell } from "../src/cradle-cell.js";

async function testDNAMaturity() {
  console.log("\n=== DNA Maturity Model Test ===\n");

  const cell = new CradleCell({ id: "cell-001" });

  try {
    // Test 1: Get maturity info
    console.log("Test 1: Get Maturity Info");
    console.log("----------------------------");
    const maturity = await cell.getMaturityInfo();
    
    console.log(`Maturity       : ${maturity.percent}%`);
    console.log(`State          : ${maturity.state}`);
    console.log(`Sample Size    : ${maturity.sampleSize}`);
    console.log(`Magnitude      : ${maturity.magnitude.toFixed(4)}`);
    console.log(`Normalized Mag : ${maturity.normalizedMagnitude.toFixed(4)}`);
    console.log(`Variance       : ${maturity.temporalVariance.toFixed(6)}`);
    console.log(`Convergence    : ${maturity.convergence.toFixed(4)}`);
    console.log("");

    // Test 2: Get maturity percentage (backward compatible)
    console.log("Test 2: Get Maturity Percentage");
    console.log("--------------------------------");
    const percent = await cell.getMaturity();
    console.log(`Maturity: ${percent}%`);
    console.log("");

    // Test 3: Check if can divide
    console.log("Test 3: Can Divide Check");
    console.log("------------------------");
    const canDivide = await cell.canDivide();
    console.log(`Can Divide: ${canDivide}`);
    
    if (!canDivide) {
      console.log("\nDivision Requirements:");
      console.log(`  ✓ Sample Size >= 5:         ${maturity.sampleSize >= 5 ? "PASS" : "FAIL"} (${maturity.sampleSize})`);
      console.log(`  ✓ Maturity >= 0.75:         ${maturity.maturity >= 0.75 ? "PASS" : "FAIL"} (${maturity.maturity.toFixed(4)})`);
      console.log(`  ✓ Variance <= 0.08:         ${maturity.temporalVariance <= 0.08 ? "PASS" : "FAIL"} (${maturity.temporalVariance.toFixed(4)})`);
      console.log(`  ✓ Normalized Mag >= 0.60:   ${maturity.normalizedMagnitude >= 0.60 ? "PASS" : "FAIL"} (${maturity.normalizedMagnitude.toFixed(4)})`);
    }
    console.log("");

    // Test 4: Show trait scores
    console.log("Test 4: Current Trait Scores");
    console.log("-----------------------------");
    for (const [trait, score] of Object.entries(maturity.currentTraitScores)) {
      console.log(`  ${trait.padEnd(20)}: ${Number(score).toFixed(4)}`);
    }
    console.log("");

    // Test 5: DNA History
    console.log("Test 5: DNA History");
    console.log("-------------------");
    const history = await cell.readDNAHistory();
    console.log(`Total entries: ${history.length}`);
    console.log(`Recent entries (last 5):`);
    history.slice(-5).forEach((item, index) => {
      console.log(`  [${index + 1}] ${item.at} - ${item.reason}`);
    });
    console.log("");

    console.log("=== Test Complete ===\n");

  } catch (error) {
    console.error("Error during test:");
    console.error(error.message);
    console.error(error.stack);
  }
}

// Run test
testDNAMaturity();
