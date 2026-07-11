import {
  CAPABILITY_RESOLUTION_STRATEGIES,
  FUSION_SOURCE_USAGES,
} from "./fusion-plan-schema.js";

/**
 * 建立 Living Context Fusion Prompt。
 *
 * @param {object} options
 * @param {Array<object>} options.parentSources
 * @param {object} options.dnaFusionPlan
 * @param {string} options.childId
 * @returns {string}
 */
export function buildLivingContextFusionPrompt({
  parentSources,
  dnaFusionPlan,
  childId,
}) {
  if (
    !Array.isArray(parentSources) ||
    parentSources.length < 2
  ) {
    throw new Error(
      "buildLivingContextFusionPrompt: parentSources must have at least 2 items"
    );
  }

  if (
    typeof childId !== "string" ||
    childId.trim() === ""
  ) {
    throw new Error(
      "buildLivingContextFusionPrompt: childId is required"
    );
  }

  const formattedParentSources =
    parentSources
      .map(
        (source, index) =>
          formatParentSource(
            source,
            index
          )
      )
      .join("\n\n");

  return `
# Living Context Fusion Planning

You are creating a new Living Context for a Cell formed by fusion.

Target Child Cell ID:

${childId}

## Core Rules

### Fusion Semantics

- Do not merely concatenate Parent responsibilities.
- Create one coherent purpose for the fused Cell.
- Resolve overlapping capabilities only when those capabilities are explicitly present in the Parent Source Materials.
- Identify a knowledge conflict only when two or more Parent Source Materials contain explicitly contradictory views.
- Parent Productions are reference material, not mandatory templates.
- Fusion may simplify, inherit, synthesize, or contract existing Parent information, but it must not invent new domain knowledge.

### Grounding Rules

- Every generated field must be grounded in the DNA Fusion Plan or Parent Cell Source Materials.
- Do not invent capabilities, responsibilities, knowledge, history, technologies, architecture styles, teams, databases, frameworks, relationships, constraints, inputs, outputs, or production requirements.
- Do not infer a technology merely because it is commonly associated with a domain.
- Do not introduce example technologies such as Java, Spring Boot, React, microservices, monoliths, SQL, or cloud platforms unless they explicitly appear in the supplied source materials.
- Do not create a relationship target unless that target explicitly appears in at least one Parent Living Context, Distilled Memory, Artifact Catalog, or DNA Fusion Plan.
- Do not create historical achievements that are not explicitly present in Parent memory.
- Do not assign a capability to a Parent Cell unless that capability is explicitly supported by that Parent's source material.
- Every capabilityResolutions[].sourceCellIds entry must refer only to Parent Cells that explicitly provide evidence for that capability.
- Every knowledgeConflicts[].view must represent information explicitly found in the corresponding Parent Cell source material.
- Every productionPlan item must be derived from an existing Parent responsibility, output, artifact, goal, or explicit fused requirement.
- Every technology or framework in productionPlan[].constraints must explicitly appear in the supplied source materials.
- sourceArtifacts may only reference artifacts listed in the Parent Artifact Catalogs.

### Missing Evidence Rules

- If there is insufficient evidence for a field, use an empty string or empty array.
- If no explicit capability overlap exists, return an empty capabilityResolutions array.
- If no explicit contradiction exists, return an empty knowledgeConflicts array.
- If no production can be safely derived from the Parent materials, return an empty productionPlan array.
- assumptions may describe missing information, but assumptions must not be converted into facts elsewhere in the Fusion Plan.
- Empty arrays are valid and preferred over invented content.

### Output Rules

- Do not generate source code.
- Do not generate Artifact JSON.
- Return only the Fusion Plan JSON.
- Do not use Markdown code fences.
- Every capabilityResolutions[].strategy must be exactly one of: ${CAPABILITY_RESOLUTION_STRATEGIES.join(", ")}.
- Every productionPlan[].sourceUsage must be exactly one of: ${FUSION_SOURCE_USAGES.join(", ")}.
- Every fusedLivingContext.relationships[] item must be an object with string fields: { "type": "...", "target": "..." }.

# DNA Fusion Plan

${formatJson(dnaFusionPlan)}

# Parent Cell Source Materials

${formattedParentSources}

# Field Requirements

- fusedLivingContext.purpose:
  A concise synthesis of explicit Parent purposes and responsibilities.

- fusedLivingContext.responsibilities:
  Only responsibilities derived from one or more Parent Cells.

- fusedMemorySeed.knowledge:
  A concise synthesis of explicit Parent knowledge. Do not fabricate expertise.

- fusedMemorySeed.history:
  Only summarize actual Parent history. Leave empty when no history is available.

- fusedMemorySeed.thought:
  May express the Child's immediate interpretation of the fusion, but must remain grounded in the actual fusion result.

- capabilityResolutions:
  Include entries only for capabilities explicitly found in Parent Source Materials.

- knowledgeConflicts:
  Include entries only for directly contradictory Parent views.

- productionPlan:
  Include only productions justified by Parent responsibilities, outputs, goals, or Artifact Catalog entries.

- assumptions:
  Use only to record missing or uncertain information. Do not treat assumptions as established facts.

# Required Output Format

${formatJson(createFusionPlanExample(childId, parentSources))}

Return only one valid JSON object.
`.trim();
}

/**
 * 格式化單一 Parent Source Material。
 *
 * Artifact Catalog 必須完整放進 Prompt，
 * 讓 AI 可以引用正確的 cellId / artifactId。
 */
function formatParentSource(
  source,
  index
) {
  const cellId =
    typeof source?.cellId === "string"
      ? source.cellId
      : `parent-${index + 1}`;

  const livingContext =
    source?.livingContext ?? {};

  const distilledMemory =
    source?.distilledMemory ?? {};

  const artifactCatalog =
    Array.isArray(source?.artifactCatalog)
      ? source.artifactCatalog
      : [];

  return `
## Parent ${index + 1}

### Cell ID

${cellId}

### Living Context

${formatJson(livingContext)}

### Distilled Memory

${formatJson(distilledMemory)}

### Artifact Catalog

${formatJson(
  artifactCatalog.map(
    artifact => ({
      artifactId:
        artifact?.artifactId ?? "",

      type:
        artifact?.type ?? "",

      title:
        artifact?.title ?? "",

      goal:
        artifact?.goal ?? "",

      status:
        artifact?.status ?? "",
    })
  )
)}
`.trim();
}

/**
 * 建立提供給 AI 的 Fusion Plan JSON 範例。
 */
function createFusionPlanExample(
  childId,
  parentSources
) {
  return {
    type: "living-context-fusion",

    parentCellIds:
      parentSources.map(
        source => source.cellId
      ),

    childCellId: childId,

    fusedLivingContext: {
      purpose: "",
      responsibilities: [],
      owns: [],
      excludes: [],
      inputs: [],
      outputs: [],
      constraints: [],
      relationships: [],
    },

    fusedMemorySeed: {
      knowledge: "",
      history: "",
      thought: "",
    },

    capabilityResolutions: [],
    knowledgeConflicts: [],
    productionPlan: [],
    assumptions: [],
  };
}

/**
 * 安全格式化 JSON。
 */
function formatJson(value) {
  try {
    return JSON.stringify(
      value ?? null,
      null,
      2
    );
  } catch {
    return String(value);
  }
}
