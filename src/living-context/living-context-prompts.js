/**
 * living-context-prompts.js
 * 
 * Living Context 相關的 AI Prompt 建構函式
 */

/**
 * 建立 Division Transformation Plan Prompt
 * 
 * @param {Object} options
 * @param {Object} options.parentSource - Parent Cell 的 Source Material
 * @param {Object} options.dnaDivisionPlan - DNA Division Plan
 * @param {string} options.childId - Child Cell ID
 * @returns {string} Prompt 文字
 */
export function buildLivingContextDivisionPrompt({ parentSource, dnaDivisionPlan, childId }) {
  const parentId = parentSource.cellId;
  const sigma = dnaDivisionPlan.sigma || 0.5;
  
  // 建立 Artifact Catalog 摘要
  let artifactCatalogText = "";
  if (parentSource.artifactCatalog && parentSource.artifactCatalog.length > 0) {
    artifactCatalogText = "\n\n## Available Parent Artifacts (Catalog Only)\n\n";
    parentSource.artifactCatalog.forEach(artifact => {
      artifactCatalogText += `### ${artifact.artifactId}\n`;
      artifactCatalogText += `- Type: ${artifact.type}\n`;
      artifactCatalogText += `- Title: ${artifact.title || "N/A"}\n`;
      artifactCatalogText += `- Goal: ${artifact.goal || "N/A"}\n`;
      artifactCatalogText += `- Status: ${artifact.status || "N/A"}\n`;
      if (artifact.languages && artifact.languages.length > 0) {
        artifactCatalogText += `- Languages: ${artifact.languages.join(", ")}\n`;
      }
      if (artifact.notes) {
        artifactCatalogText += `- Notes: ${artifact.notes}\n`;
      }
      artifactCatalogText += "\n";
    });
  } else {
    artifactCatalogText = "\n\n## Available Parent Artifacts\n\nNo artifacts available.\n\n";
  }

  // 建立 DNA Plan 摘要
  const dnaTraitsText = dnaDivisionPlan.childDominantTraits
    ? dnaDivisionPlan.childDominantTraits.map(t => `- ${t}`).join("\n")
    : "N/A";

  const dnaFactorsText = dnaDivisionPlan.childDominantFactors
    ? JSON.stringify(dnaDivisionPlan.childDominantFactors, null, 2)
    : "N/A";

  const prompt = `# Cell Division: Living Context Transformation Plan

You are tasked with creating a **Living Context Transformation Plan** for a cell division process.

## Context

**Parent Cell ID**: ${parentId}
**Child Cell ID**: ${childId}
**Division Sigma**: ${sigma}

## DNA Division Plan

The DNA SVD division plan indicates the following specialization direction:

**Child Dominant Traits**:
${dnaTraitsText}

**Child Dominant Factors**:
\`\`\`json
${dnaFactorsText}
\`\`\`

**Reason**: ${dnaDivisionPlan.reason || "N/A"}

## Parent Living Context

\`\`\`json
${JSON.stringify(parentSource.livingContext, null, 2)}
\`\`\`

## Parent Responsibilities

${parentSource.responsibilities && parentSource.responsibilities.length > 0
  ? parentSource.responsibilities.map(r => `- ${r}`).join("\n")
  : "None"}

## Parent Memory (Distilled)

### Identity
${parentSource.memory?.identity || "N/A"}

### Rules (excerpt)
${parentSource.memory?.rules || "N/A"}

### Knowledge (excerpt)
${parentSource.memory?.knowledge || "N/A"}

### Recent History (excerpt)
${parentSource.memory?.recentHistory || "N/A"}

### Recent Thoughts (excerpt)
${parentSource.memory?.recentThoughts || "N/A"}

${artifactCatalogText}

---

## Your Task

Generate a **Living Context Division Transformation Plan** in **strict JSON format**.

### Critical Rules

1. **SVD DNA Plan** represents capability specialization direction.
2. **Living Context** represents business/functional responsibility boundaries.
3. You MUST generate both \`revisedParentLivingContext\` and \`childLivingContext\`.
4. **Parent** must NOT retain primary ownership that is explicitly transferred to **Child**, unless marked as a shared contract.
5. **Child** must NOT directly inherit all of Parent's responsibilities.
6. \`childMemorySeed\` MUST be **distilled knowledge**, NOT raw copy of entire Parent Memory.
7. \`productionPlan\` can be an empty array.
8. \`sourceArtifactIds\` can ONLY use artifact IDs that exist in the Parent Artifact Catalog above.
9. Source Artifacts are **reference material only**, they must NOT override Child Living Context.
10. Do NOT generate Artifact JSON directly; this step only generates the Transformation Plan.

### Priority Order (MUST follow)

1. **Living Context** (defines boundaries)
2. **Distilled Memory** (provides knowledge seed)
3. **Selected Productions** (optional reference material)

### Output JSON Schema

You MUST output ONLY valid JSON with the following structure:

\`\`\`json
{
  "type": "living-context-division",
  "parentCellId": "${parentId}",
  "childCellId": "${childId}",
  
  "revisedParentLivingContext": {
    "purpose": "string describing revised parent purpose",
    "responsibilities": ["responsibility 1", "responsibility 2"],
    "owns": ["ownership 1", "ownership 2"],
    "excludes": ["explicitly exclude this responsibility"],
    "inputs": ["input 1"],
    "outputs": ["output 1"],
    "constraints": ["constraint 1"],
    "relationships": [
      {
        "type": "depends-on | provides-to | shares-with",
        "target": "cell-id or external-system",
        "description": "relationship description"
      }
    ]
  },
  
  "childLivingContext": {
    "purpose": "string describing child purpose",
    "responsibilities": ["child responsibility 1", "child responsibility 2"],
    "owns": ["child ownership 1"],
    "excludes": ["explicitly exclude from child"],
    "inputs": ["child input 1"],
    "outputs": ["child output 1"],
    "constraints": ["child constraint 1"],
    "relationships": [
      {
        "type": "depends-on | provides-to | shares-with",
        "target": "cell-id or external-system",
        "description": "relationship description"
      }
    ]
  },
  
  "childMemorySeed": {
    "knowledge": "Markdown formatted distilled knowledge relevant to child's new responsibility",
    "history": "Markdown formatted history explaining child's birth and specialization",
    "thought": "Markdown formatted initial thought about child's purpose and direction"
  },
  
  "productionPlan": [
    {
      "type": "code | test | document | config | interface",
      "title": "New production title",
      "goal": "Clear and specific goal for this production",
      "constraints": ["constraint 1", "constraint 2"],
      "sourceArtifactIds": ["artifact-xxx", "artifact-yyy"],
      "sourceUsage": "reference"
    }
  ],
  
  "sharedContracts": [
    "Description of shared contract or interface between parent and child"
  ],
  
  "assumptions": [
    "Assumption 1 made during this plan",
    "Assumption 2"
  ]
}
\`\`\`

### Important Notes

- **DO NOT** just union or split responsibilities mechanically.
- **DO NOT** copy entire Parent Memory as-is into \`childMemorySeed\`.
- **DO NOT** list artifact IDs that don't exist in the Parent Artifact Catalog.
- **sourceUsage** should always be \`"reference"\` - source artifacts are NOT mandatory inheritance.
- If no Parent Artifacts are available, \`productionPlan\` can still be populated with new production goals, just leave \`sourceArtifactIds\` empty.
- Child productions MUST be regenerated based on Child Living Context, NOT copied directly.
- Cross-boundary dependencies should be transformed into interfaces, ports, events, contracts, or explicit inputs/outputs.

### Output Format

Output **ONLY** the JSON object. Do NOT include any explanation text before or after the JSON.
`;

  return prompt;
}
