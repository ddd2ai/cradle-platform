import {
  applyArtifactChangePlan,
} from "./artifact-change-plan.js";
import {
  buildArtifactImpactTerms,
  buildArtifactRepairHead,
  evolveArtifactRepairHead,
} from "./artifact-impact-index.js";

export class ArtifactChangePlanMutationService {
  constructor({ store, validator, incrementalValidator } = {}) {
    if (!store || !validator || !incrementalValidator) {
      throw new Error(
        "ArtifactChangePlanMutationService requires store, validator, and incrementalValidator"
      );
    }
    this.store = store;
    this.validator = validator;
    this.incrementalValidator = incrementalValidator;
  }

  async apply(changePlan, { prepared } = {}) {
    if (!changePlan?.artifactId || !Array.isArray(changePlan.changes)) {
      throw new Error("ArtifactChangePlanMutationService requires changePlan");
    }
    const outputPaths = changePlan.changes.map((change) => change.path);
    return await this.store.transactArtifactMutation(
      changePlan.artifactId,
      async (transaction) => {
        const currentRevision = await transaction.readCurrentRevisionState();
        if (isCurrentPreparedMutation({ changePlan, prepared, currentRevision })) {
          const saved = await transaction.saveArtifactDelta({
            artifact: prepared.artifact,
            baseHead: prepared.baseHead,
            nextHead: prepared.nextHead,
          });
          return {
            artifact: prepared.artifact,
            changePlan,
            saved,
            validation: prepared.validation,
            rebased: false,
            baseMode: prepared.baseMode ?? "head",
            prepared: true,
          };
        }
        const base = await this.#readCurrentBase({
          artifactId: changePlan.artifactId,
          outputPaths,
          transaction,
          currentRevision,
        });
        const rebasedPlan = {
          ...changePlan,
          baseRevisionId: base.head.revision?.revisionId ?? null,
        };
        let artifact = applyArtifactChangePlan({
          artifact: { ...base.head, outputs: base.outputs },
          changePlan: rebasedPlan,
        });
        const incrementalValidation = this.incrementalValidator.validate({
          artifact,
          changePlan: rebasedPlan,
          baseHead: base.head,
          baseOutputs: base.outputs,
        });

        let saved;
        if (incrementalValidation.requiresFullValidation) {
          const fullyHydrated = await this.store.readArtifact(changePlan.artifactId);
          artifact = applyArtifactChangePlan({
            artifact: fullyHydrated,
            changePlan: rebasedPlan,
          });
          this.validator.validate(artifact);
          saved = await transaction.saveArtifact(artifact);
        } else {
          const nextHead = evolveArtifactRepairHead({
            baseHead: base.head,
            artifact,
            previousOutputs: base.outputs,
            nextOutputs: artifact.outputs,
          });
          saved = await transaction.saveArtifactDelta({
            artifact,
            baseHead: base.head,
            nextHead,
          });
        }

        return {
          artifact,
          changePlan: rebasedPlan,
          saved,
          validation: incrementalValidation,
          rebased: changePlan.baseRevisionId !== rebasedPlan.baseRevisionId,
          baseMode: base.mode,
          prepared: false,
        };
      }
    );
  }

  async #readCurrentBase({
    artifactId,
    outputPaths,
    transaction,
    currentRevision,
  }) {
    let repairContext = await this.store.readArtifactRepairContext(artifactId);
    const manifest = await this.store.readArtifactManifest(artifactId);
    if (
      repairContext.artifact?.revision?.revisionId !== currentRevision.revisionId
    ) {
      repairContext = {
        artifact: await this.store.readArtifactManifest(artifactId),
        mode: "manifest-fallback",
      };
    }
    const existingOutputPaths = new Set(
      (manifest.outputs ?? []).map((output) => output.path)
    );
    const currentOutputPaths = outputPaths.filter((outputPath) =>
      existingOutputPaths.has(outputPath)
    );

    if (repairContext.mode === "head") {
      const lookupKeys = currentOutputPaths.flatMap((outputPath) =>
        buildArtifactImpactTerms({ kind: "file", path: outputPath })
      );
      const candidates = await this.store.findArtifactImpactCandidates(
        artifactId,
        lookupKeys,
        { revisionId: currentRevision.revisionId }
      );
      const outputPathSet = new Set(currentOutputPaths);
      const candidateOutputs = (candidates.outputs ?? []).filter(
        (output) => outputPathSet.has(output.path)
      );
      if (
        candidates.available &&
        candidateOutputs.length === outputPathSet.size
      ) {
        return {
          head: repairContext.artifact,
          outputs: await this.store.readArtifactOutputs(
            artifactId,
            currentOutputPaths,
            { manifest: { outputs: candidateOutputs } }
          ),
          mode: "head",
        };
      }
    }

    const fallbackManifest = repairContext.mode === "manifest-fallback"
      ? repairContext.artifact
      : manifest;
    return {
      head: buildArtifactRepairHead(fallbackManifest),
      outputs: await this.store.readArtifactOutputs(
        artifactId,
        currentOutputPaths,
        { manifest: fallbackManifest }
      ),
      mode: "manifest-fallback",
    };
  }
}

function isCurrentPreparedMutation({ changePlan, prepared, currentRevision }) {
  if (
    !prepared?.artifact ||
    !prepared.baseHead ||
    !prepared.nextHead ||
    prepared.validation?.requiresFullValidation !== false ||
    currentRevision.revisionId !== changePlan.baseRevisionId ||
    prepared.baseHead.revision?.revisionId !== changePlan.baseRevisionId ||
    prepared.artifact.revision?.revisionId !== changePlan.revisionId ||
    prepared.nextHead.revision?.revisionId !== changePlan.revisionId
  ) {
    return false;
  }
  const expectedPaths = new Set(changePlan.changes.map((change) => change.path));
  const preparedPaths = new Set(
    prepared.artifact.outputs?.map((output) => output.path) ?? []
  );
  return expectedPaths.size === preparedPaths.size &&
    [...expectedPaths].every((outputPath) => preparedPaths.has(outputPath));
}
