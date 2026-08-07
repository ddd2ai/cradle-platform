const VALID_ROLES = new Set(["parent", "child"]);
const VALID_METHODS = new Set([
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
]);

function artifactCode(artifact) {
  return (artifact.outputs ?? [])
    .filter((output) => output.kind === "file")
    .map((output) => String(output.content ?? ""))
    .join("\n")
    .toLowerCase();
}

export class DivisionProductContractValidator {
  validate({ parentArtifact, childArtifact, productContract }) {
    const invocations = productContract?.apiInvocations;

    if (!Array.isArray(invocations) || invocations.length === 0) {
      throw new Error("Division product contract requires at least one API invocation");
    }

    const artifacts = {
      parent: parentArtifact,
      child: childArtifact,
    };

    for (const [index, invocation] of invocations.entries()) {
      this._validateInvocation(invocation, index, artifacts);
    }

    return productContract;
  }

  _validateInvocation(invocation, index, artifacts) {
    const prefix = `API invocation ${index + 1}`;
    const sourceRole = invocation?.sourceRole;
    const targetRole = invocation?.targetRole;
    const method = String(invocation?.method ?? "").toUpperCase();
    const path = String(invocation?.path ?? "").trim();

    if (!VALID_ROLES.has(sourceRole) || !VALID_ROLES.has(targetRole)) {
      throw new Error(`${prefix} must use parent or child roles`);
    }
    if (sourceRole === targetRole) {
      throw new Error(`${prefix} sourceRole and targetRole must differ`);
    }
    if (!VALID_METHODS.has(method)) {
      throw new Error(`${prefix} has unsupported HTTP method: ${method || "missing"}`);
    }
    if (!path.startsWith("/")) {
      throw new Error(`${prefix} path must be an absolute API path`);
    }
    if (!Array.isArray(invocation.requestSchema)) {
      throw new Error(`${prefix} requestSchema must be an array`);
    }
    if (!Array.isArray(invocation.responseSchema)) {
      throw new Error(`${prefix} responseSchema must be an array`);
    }

    this._validateArtifactImplementsInvocation({
      artifact: artifacts[sourceRole],
      role: sourceRole,
      method,
      path,
      prefix,
    });
    this._validateArtifactImplementsInvocation({
      artifact: artifacts[targetRole],
      role: targetRole,
      method,
      path,
      prefix,
    });
    this._validateSchemaFields({
      artifacts: [artifacts[sourceRole], artifacts[targetRole]],
      fields: [
        ...invocation.requestSchema,
        ...invocation.responseSchema,
      ],
      prefix,
    });

    invocation.method = method;
    invocation.path = path;
  }

  _validateArtifactImplementsInvocation({ artifact, role, method, path, prefix }) {
    const code = artifactCode(artifact);
    const normalizedPath = path.toLowerCase();
    const normalizedMethod = method.toLowerCase();

    if (!code.includes(normalizedPath)) {
      throw new Error(`${prefix} ${role} product does not implement path ${path}`);
    }
    if (!code.includes(normalizedMethod)) {
      throw new Error(`${prefix} ${role} product does not implement method ${method}`);
    }
  }

  _validateSchemaFields({ artifacts, fields, prefix }) {
    const fieldNames = fields
      .map((field) => String(field?.name ?? "").trim())
      .filter(Boolean);

    for (const fieldName of fieldNames) {
      for (const artifact of artifacts) {
        if (!artifactCode(artifact).includes(fieldName.toLowerCase())) {
          throw new Error(
            `${prefix} product does not implement schema field ${fieldName}`
          );
        }
      }
    }
  }
}
