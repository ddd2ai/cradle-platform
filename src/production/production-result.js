/**
 * production-result.js
 *
 * Shared result builders for artifact production workflows.
 */

export function createDivisionProductionResult({
  produced = [],
  parentRevisions = [],
  failed = [],
  skipped = [],
  complete = true,
} = {}) {
  return {
    produced,
    parentRevisions,
    failed,
    skipped,
    complete,
  };
}

export function createFusionProductionResult({
  produced = [],
  failed = [],
  skipped = [],
  complete = true,
} = {}) {
  return {
    produced,
    failed,
    skipped,
    complete,
  };
}
