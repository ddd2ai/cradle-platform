import {
  DIVISION_PRODUCTION_ACTIONS,
} from "../living-context/division-plan-schema.js";

export function validateProductionPlan({
  parentArtifacts,
  livingContextPlan,
  parentCellId,
  childId,
}) {
  if (!livingContextPlan) {
    throw new Error(
      "CellDivisionService: livingContextPlan is required"
    );
  }

  const productionPlan =
    livingContextPlan.productionPlan;

  if (!Array.isArray(productionPlan)) {
    throw new Error(
      "CellDivisionService: productionPlan must be an array"
    );
  }

  if (
    parentArtifacts.length > 0 &&
    productionPlan.length === 0
  ) {
    throw new Error(
      "CellDivisionService: parent has artifacts but productionPlan is empty"
    );
  }

  const allowedActions =
    new Set(DIVISION_PRODUCTION_ACTIONS);

  const parentArtifactIds =
    parentArtifacts
      .map(
        (artifact) =>
          artifact.artifactId ??
          artifact.id
      )
      .filter(Boolean);

  const plannedIds = [];

  for (const item of productionPlan) {
    validateProductionPlanItem({
      item,
      allowedActions,
      parentCellId,
      childId,
    });

    plannedIds.push(
      item.sourceArtifactId
    );
  }

  validatePlannedArtifactIds({
    parentArtifactIds,
    plannedIds,
  });
}

export function validateBasicDivisionSemantics({ livingContextPlan }) {
  const parent = livingContextPlan.revisedParentLivingContext || {};
  const child = livingContextPlan.childLivingContext || {};

  const parentResponsibilities = normalizeStringList(parent.responsibilities);
  const childResponsibilities = normalizeStringList(child.responsibilities);
  const parentOwns = normalizeStringList(parent.owns);
  const childOwns = normalizeStringList(child.owns);

  const genericPurposePattern =
    /^(coordinate child cells|manage children|maintain system|coordinate children)$/i;

  const hasBusinessResponsibility =
    parentResponsibilities.length > 0 ||
    parentOwns.length > 0 ||
    normalizeStringList(parent.outputs).length > 0;

  if (
    typeof parent.purpose === "string" &&
    genericPurposePattern.test(parent.purpose.trim()) &&
    !hasBusinessResponsibility
  ) {
    throw new Error(
      "CellDivisionService: parent purpose is too generic to preserve parent identity"
    );
  }

  if (!hasBusinessResponsibility) {
    throw new Error(
      "CellDivisionService: parent must retain at least one responsibility, ownership, or output"
    );
  }

  const responsibilityOverlap =
    parentResponsibilities.filter((item) => childResponsibilities.includes(item));

  if (responsibilityOverlap.length > 0) {
    throw new Error(
      `CellDivisionService: parent/child responsibility overlap: ${responsibilityOverlap.join(", ")}`
    );
  }

  const ownershipOverlap =
    parentOwns.filter((item) => childOwns.includes(item));

  if (ownershipOverlap.length > 0) {
    throw new Error(
      `CellDivisionService: parent/child ownership overlap: ${ownershipOverlap.join(", ")}`
    );
  }
}

export function validateSharedContractReferences({
  engine,
  parentCellId,
  childId,
  livingContextPlan,
}) {
  const contracts = livingContextPlan.sharedContracts || [];

  if (!Array.isArray(contracts) || contracts.length === 0) {
    return;
  }

  const validCellIds = resolveKnownCellIds({
    engine,
    parentCellId,
    childId,
  });

  for (const contract of contracts) {
    const referencedIds = [
      contract.ownerCellId,
      ...(contract.consumerCellIds || []),
    ].filter(Boolean);

    for (const cellId of referencedIds) {
      if (
        !isKnownCellId({
          engine,
          cellId,
          parentCellId,
          childId,
          validCellIds,
        })
      ) {
        throw new Error(
          `CellDivisionService: shared contract references unknown cell: ${cellId}`
        );
      }
    }
  }
}

function validateProductionPlanItem({
  item,
  allowedActions,
  parentCellId,
  childId,
}) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    throw new Error(
      "CellDivisionService: productionPlan item must be an object"
    );
  }

  if (
    typeof item.sourceArtifactId !==
      "string" ||
    !item.sourceArtifactId.trim()
  ) {
    throw new Error(
      "CellDivisionService: sourceArtifactId is required"
    );
  }

  if (!allowedActions.has(item.action)) {
    throw new Error(
      `CellDivisionService: unsupported production action: ${item.action}`
    );
  }

  if (
    typeof item.targetCellId !== "string" ||
    !item.targetCellId.trim()
  ) {
    throw new Error(
      "CellDivisionService: targetCellId is required"
    );
  }

  if (
    item.action === "keep" &&
    item.targetCellId !== parentCellId
  ) {
    throw new Error(
      "CellDivisionService: keep action must target parent cell"
    );
  }

  if (
    (item.action === "transfer" || item.action === "derive") &&
    item.targetCellId !== childId
  ) {
    throw new Error(
      `CellDivisionService: ${item.action} action must target child cell`
    );
  }
}

function validatePlannedArtifactIds({
  parentArtifactIds,
  plannedIds,
}) {
  const uniquePlannedIds =
    new Set(plannedIds);

  if (
    uniquePlannedIds.size !==
    plannedIds.length
  ) {
    throw new Error(
      "CellDivisionService: duplicate sourceArtifactId in productionPlan"
    );
  }

  for (const artifactId of parentArtifactIds) {
    if (!uniquePlannedIds.has(artifactId)) {
      throw new Error(
        `CellDivisionService: artifact missing from productionPlan: ${artifactId}`
      );
    }
  }

  for (const artifactId of plannedIds) {
    if (!parentArtifactIds.includes(artifactId)) {
      throw new Error(
        `CellDivisionService: unknown artifact in productionPlan: ${artifactId}`
      );
    }
  }
}

function resolveKnownCellIds({
  engine,
  parentCellId,
  childId,
}) {
  const validCellIds = new Set([
    parentCellId,
    childId,
  ]);

  if (typeof engine.listCellIds === "function") {
    for (const cellId of engine.listCellIds()) {
      if (cellId) {
        validCellIds.add(cellId);
      }
    }
  } else if (engine.cells && typeof engine.cells.keys === "function") {
    for (const cellId of engine.cells.keys()) {
      if (cellId) {
        validCellIds.add(cellId);
      }
    }
  }

  return validCellIds;
}

function isKnownCellId({
  engine,
  cellId,
  parentCellId,
  childId,
  validCellIds,
}) {
  if (
    cellId === parentCellId ||
    cellId === childId ||
    validCellIds.has(cellId)
  ) {
    return true;
  }

  return (
    typeof engine.hasCell === "function" &&
    engine.hasCell(cellId)
  );
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => typeof value === "string" ? value.trim().toLowerCase() : "")
    .filter(Boolean);
}
