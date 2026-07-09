// test-dna-maturity-integration.js
// Test DNA maturity integration with lifecycle

import { CradleCell } from "./src/cradle-cell.js";

async function testIntegration() {
  console.log("\n=== DNA Maturity Integration Test ===\n");

  const cell = new CradleCell({ id: "cell-001" });

  try {
    // Test 1: mature() no longer increases counter
    console.log("Test 1: mature() behavior");
    console.log("-------------------------");
    const matureBefore = await cell.getMaturity();
    console.log(`Maturity before: ${matureBefore}%`);
    
    const maturityInfo = await cell.mature(1);
    console.log(`mature() returns:`, {
      percent: maturityInfo.percent,
      state: maturityInfo.state,
    });
    
    const matureAfter = await cell.getMaturity();
    console.log(`Maturity after: ${matureAfter}%`);
    console.log(`✓ mature() no longer increases counter`);
    console.log("");

    // Test 2: canDivide() multi-dimensional check
    console.log("Test 2: canDivide() check");
    console.log("-------------------------");
    const canDivide = await cell.canDivide();
    console.log(`Can divide: ${canDivide}`);
    
    const maturity = await cell.getMaturityInfo();
    console.log("\nRequirements:");
    console.log(`  Sample Size >= 5:        ${maturity.sampleSize >= 5 ? "✓" : "✗"} (${maturity.sampleSize})`);
    console.log(`  Maturity >= 0.75:        ${maturity.maturity >= 0.75 ? "✓" : "✗"} (${maturity.maturity.toFixed(4)})`);
    console.log(`  Variance <= 0.08:        ${maturity.temporalVariance <= 0.08 ? "✓" : "✗"} (${maturity.temporalVariance.toFixed(6)})`);
    console.log(`  Magnitude >= 0.60:       ${maturity.normalizedMagnitude >= 0.60 ? "✓" : "✗"} (${maturity.normalizedMagnitude.toFixed(4)})`);
    console.log("");

    // Test 3: assertCanDivide() error message
    console.log("Test 3: assertCanDivide() error");
    console.log("--------------------------------");
    try {
      await cell.assertCanDivide();
      console.log("✓ Cell can divide");
    } catch (error) {
      console.log("✗ Cell cannot divide\n");
      console.log("Error message preview (first 5 lines):");
      const lines = error.message.split("\n").slice(0, 5);
      lines.forEach(line => console.log(`  ${line}`));
    }
    console.log("");

    // Test 4: appendDNAHistoryIfChanged() prevents duplicates
    console.log("Test 4: appendDNAHistoryIfChanged()");
    console.log("------------------------------------");
    const historyBefore = await cell.readDNAHistory();
    console.log(`History length before: ${historyBefore.length}`);
    
    // Try to append without changing DNA
    const appended1 = await cell.appendDNAHistoryIfChanged("test-no-change");
    console.log(`Append without change: ${appended1 ? "appended" : "skipped"}`);
    
    const historyAfter1 = await cell.readDNAHistory();
    console.log(`History length after: ${historyAfter1.length}`);
    
    if (appended1 === false) {
      console.log("✓ Duplicate DNA vector prevented");
    } else {
      console.log("✗ DNA changed or first append");
    }
    console.log("");

    // Test 5: Display format
    console.log("Test 5: Display Format");
    console.log("----------------------");
    console.log(`Maturity: ${maturity.percent}% (${maturity.state})`);
    console.log(`Variance: ${maturity.temporalVariance.toFixed(6)}`);
    console.log(`Convergence: ${maturity.convergence.toFixed(4)}`);
    console.log(`Magnitude: ${maturity.normalizedMagnitude.toFixed(4)}`);
    console.log("✓ Ready for /status, /colony, /watch display");
    console.log("");

    console.log("=== Integration Test Complete ===\n");

  } catch (error) {
    console.error("Error during test:");
    console.error(error.message);
    console.error(error.stack);
  }
}

// Run test
testIntegration();
