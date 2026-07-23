export async function runApplicationStage(errors, stage, callback) {
  try {
    await callback();
  } catch (error) {
    errors.push({
      stage,
      message: error.message,
    });
    throw error;
  }
}

export function logProductionResult(productionResult) {
  if (productionResult.produced.length > 0) {
    console.log(`  ✅ Produced ${productionResult.produced.length} artifact(s)`);
  }

  if (productionResult.failed.length > 0) {
    console.log(`  ⚠️  ${productionResult.failed.length} artifact(s) failed`);
  }
}
