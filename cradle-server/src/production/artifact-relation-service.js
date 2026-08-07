import crypto from "node:crypto";

export class ArtifactRelationService {
  async linkDivisionProducts({
    parentCell,
    childCell,
    parentProduct,
    childProduct,
    divisionPlan,
  }) {
    const parentRef = {
      cellId: parentCell.id,
      artifactId: parentProduct.artifactId,
    };
    const childRef = {
      cellId: childCell.id,
      artifactId: childProduct.artifactId,
    };
    const apiInvocations = this._createApiInvocations({
      parentRef,
      childRef,
      sharedContracts: divisionPlan.sharedContracts ?? [],
    });
    const primaryInvocation = apiInvocations[0] ?? {
      sourceProduct: parentRef,
      targetProduct: childRef,
    };

    const relation = {
      id: crypto.randomUUID(),
      type: "api-invocation",
      sourceProduct: primaryInvocation.sourceProduct,
      targetProduct: primaryInvocation.targetProduct,
      apiInvocations,
      contracts: structuredClone(divisionPlan.sharedContracts ?? []),
      createdAt: new Date().toISOString(),
    };

    await this._persistRelation(parentCell, parentProduct.artifactId, relation);
    await this._persistRelation(childCell, childProduct.artifactId, relation);

    return relation;
  }

  _createApiInvocations({ parentRef, childRef, sharedContracts }) {
    const productByCellId = new Map([
      [parentRef.cellId, parentRef],
      [childRef.cellId, childRef],
    ]);
    const invocations = [];

    for (const contract of sharedContracts) {
      const targetProduct = productByCellId.get(contract.ownerCellId);
      if (!targetProduct) {
        continue;
      }

      for (const consumerCellId of contract.consumerCellIds ?? []) {
        const sourceProduct = productByCellId.get(consumerCellId);
        if (!sourceProduct || sourceProduct.cellId === targetProduct.cellId) {
          continue;
        }

        invocations.push({
          contractName: contract.name,
          sourceProduct,
          targetProduct,
          inputs: structuredClone(contract.inputs ?? []),
          outputs: structuredClone(contract.outputs ?? []),
        });
      }
    }

    return invocations;
  }

  async _persistRelation(cell, artifactId, relation) {
    const store = cell.artifactStore ?? cell.productionService?.store;

    // Test doubles and legacy adapters may expose production without persistence.
    if (
      !store ||
      typeof store.readArtifact !== "function" ||
      typeof store.saveArtifact !== "function"
    ) {
      return;
    }

    const artifact = await store.readArtifact(artifactId);
    const relations = Array.isArray(artifact.relations)
      ? artifact.relations
      : [];

    await store.saveArtifact({
      ...artifact,
      relations: [...relations, relation],
      updatedAt: new Date().toISOString(),
    });
  }
}
