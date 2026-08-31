import { getArtifactTypePolicy } from "./artifact-type-policy.js";
import {
  buildContentTermIndexKey,
  hashContentTerm,
  hasIndexedContentTerm,
} from "./artifact-content-index.js";

export class ArtifactIncrementalValidator {
  constructor({ validator } = {}) {
    if (!validator) {
      throw new Error("ArtifactIncrementalValidator requires validator");
    }
    this.validator = validator;
  }

  validate({ artifact, changePlan, baseHead, baseOutputs = [] } = {}) {
    this.validator.validateBasicArtifact(artifact);
    const changedPaths = new Set(
      (changePlan?.changes ?? []).map((change) => change.path)
    );
    const policy = getArtifactTypePolicy(artifact.type);

    for (const output of artifact.outputs ?? []) {
      this.validator.validateOutputPath(output);
      this.validator.validateOutputLanguage(output, policy);
      this.validator.validateOutputExtension(output, policy);
      if (changedPaths.has(output.path)) {
        this.validator.validateOutputContent(output, artifact.type);
      }
    }

    this.validator.validateTextQuality(artifact);
    const fidelity = baseHead
      ? this.#validateGoalFidelityFromHead({ artifact, baseHead, baseOutputs })
      : this.#validateGoalFidelity(artifact);
    if (fidelity.requiresFullValidation) return fidelity;
    return { requiresFullValidation: false };
  }

  #validateGoalFidelityFromHead({ artifact, baseHead, baseOutputs }) {
    const requirements = this.validator
      .extractRequirements(String(artifact.goal ?? "").toLowerCase())
      .filter((requirement) => requirement.required);

    for (const requirement of requirements) {
      const termHash = hashContentTerm(requirement.term);
      if (!Object.hasOwn(baseHead.goalTermCoverage ?? {}, termHash)) {
        return {
          requiresFullValidation: true,
          reason: `goal-term-coverage-unavailable:${requirement.term}`,
        };
      }
      const previousCoverage = baseOutputs.reduce(
        (count, output) => count + Number(outputContainsTerm(output, requirement.term)),
        0
      );
      const nextCoverage = (artifact.outputs ?? []).reduce(
        (count, output) => count + Number(outputContainsTerm(output, requirement.term)),
        0
      );
      const coverage = Number(baseHead.goalTermCoverage[termHash] ?? 0) -
        previousCoverage + nextCoverage;
      if (coverage <= 0) {
        return {
          requiresFullValidation: true,
          reason: `goal-term-not-proven:${requirement.term}`,
        };
      }
    }
    return { requiresFullValidation: false };
  }

  #validateGoalFidelity(artifact) {
    const requirements = this.validator
      .extractRequirements(String(artifact.goal ?? "").toLowerCase())
      .filter((requirement) => requirement.required);
    const indexKey = buildContentTermIndexKey(
      requirements.map((requirement) => requirement.term)
    );

    for (const requirement of requirements) {
      const found = (artifact.outputs ?? []).some((output) => {
        const outputPath = String(output?.path ?? "").toLowerCase();
        if (outputPath.includes(requirement.term)) return true;
        if (typeof output?.content === "string") {
          return output.content.toLowerCase().includes(requirement.term);
        }
        return output.contentTermIndexComplete === true &&
          output.contentTermIndexKey === indexKey &&
          hasIndexedContentTerm(output, requirement.term);
      });

      if (!found) {
        return {
          requiresFullValidation: true,
          reason: `goal-term-not-proven:${requirement.term}`,
        };
      }
    }

    return { requiresFullValidation: false };
  }
}

function outputContainsTerm(output, term) {
  const normalizedTerm = String(term).toLowerCase();
  if (String(output?.path ?? "").toLowerCase().includes(normalizedTerm)) {
    return true;
  }
  if (typeof output?.content === "string") {
    return output.content.toLowerCase().includes(normalizedTerm);
  }
  return hasIndexedContentTerm(output, normalizedTerm);
}
