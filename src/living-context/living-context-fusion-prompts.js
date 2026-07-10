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

- Do not merely concatenate Parent responsibilities.
- Create one coherent purpose for the fused Cell.
- Resolve overlapping capabilities.
- Explicitly identify and resolve conflicting knowledge.
- Parent Productions are reference material, not mandatory templates.
- Do not generate source code.
- Do not generate Artifact JSON.
- Return only the Fusion Plan JSON.
- Do not use Markdown code fences.

# DNA Fusion Plan

${formatJson(dnaFusionPlan)}

# Parent Cell Source Materials

${formattedParentSources}

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

    capabilityResolutions: [
      {
        capability: "",
        sourceCellIds: [],
        strategy: "inherit",
        resolution: "",
      },
    ],

    knowledgeConflicts: [
      {
        topic: "",
        views: [
          {
            cellId: "",
            view: "",
          },
        ],
        resolution: "",
      },
    ],

    productionPlan: [
      {
        type: "code",
        title: "",
        goal: "",
        constraints: [],

        sourceArtifacts: [
          {
            cellId: "",
            artifactId: "",
          },
        ],

        sourceUsage: "reference",
      },
    ],

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