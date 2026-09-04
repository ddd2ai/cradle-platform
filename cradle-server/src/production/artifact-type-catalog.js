export const ARTIFACT_TYPE_CATALOG = Object.freeze([
  artifactType("code", "Code", "Source code and the minimum project files required by the Goal."),
  artifactType("document", "Document", "General documents, reports, README files, and articles."),
  artifactType("spec", "Specification", "Requirements, technical, API, and behavior specifications."),
  artifactType("research", "Research", "Evidence-bounded research and investigation reports."),
  artifactType("test", "Test", "Test programs, cases, fixtures, and machine-readable test assets."),
  artifactType("diagram", "Diagram", "Mermaid or PlantUML diagrams."),
  artifactType("image", "Image", "Safe, self-contained SVG images that Cradle can validate and preview."),
  artifactType("config", "Configuration", "JSON, YAML, properties, or environment configuration."),
  artifactType("sql", "SQL", "SQL schema, migration, or data scripts."),
  artifactType("prompt", "Prompt", "Reusable prompts stored as structured Markdown."),
  artifactType("decision", "Decision", "Architecture and product decision records."),
  artifactType("task", "Task", "Structured implementation or operational task documents."),
]);

export const LEGACY_ARTIFACT_TYPE_CATALOG = Object.freeze([
  artifactType(
    "executable-java",
    "Executable Java",
    "Legacy single-file Java compatibility type.",
    { legacy: true },
  ),
]);

const TYPE_IDS = new Set([
  ...ARTIFACT_TYPE_CATALOG,
  ...LEGACY_ARTIFACT_TYPE_CATALOG,
].map((entry) => entry.id));

export function isSupportedArtifactType(type) {
  return TYPE_IDS.has(normalizeArtifactType(type));
}

export function listSupportedArtifactTypes({ includeLegacy = false } = {}) {
  return includeLegacy
    ? [...ARTIFACT_TYPE_CATALOG, ...LEGACY_ARTIFACT_TYPE_CATALOG]
    : [...ARTIFACT_TYPE_CATALOG];
}

export function normalizeArtifactType(type) {
  return String(type ?? "").trim().toLowerCase();
}

export function assertSupportedArtifactType(type) {
  const normalized = normalizeArtifactType(type);
  if (isSupportedArtifactType(normalized)) return normalized;

  const error = new Error(
    `Unsupported Artifact type: ${normalized || "(missing)"}. Supported types: ${[
      ...TYPE_IDS,
    ].join(", ")}`,
  );
  error.code = "UNSUPPORTED_ARTIFACT_TYPE";
  error.supportedTypes = [...TYPE_IDS];
  throw error;
}

function artifactType(id, label, description, options = {}) {
  return Object.freeze({
    id,
    label,
    description,
    legacy: options.legacy === true,
  });
}
