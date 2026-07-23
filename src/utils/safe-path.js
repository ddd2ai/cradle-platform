import path from "path";

export function resolveInsideRoot(rootDir, relativePath, { errorMessage } = {}) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(rootDir, relativePath);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(
      typeof errorMessage === "function"
        ? errorMessage(relativePath)
        : errorMessage || `Path escapes root: ${relativePath}`
    );
  }

  return resolved;
}
