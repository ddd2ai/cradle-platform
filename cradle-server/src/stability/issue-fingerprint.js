import crypto from "crypto";

export function createIssueFingerprint({
  artifactId,
  executionResult,
} = {}) {
  const status = executionResult?.status ?? "unknown";

  const stderr =
    String(executionResult?.stderr ?? "")
      .split("\n")
      .slice(0, 5)
      .join("\n")
      .trim();

  const error =
    String(executionResult?.error ?? "")
      .split("\n")
      .slice(0, 5)
      .join("\n")
      .trim();

  const source = [
    artifactId,
    status,
    stderr,
    error,
  ].join("\n---\n");

  return crypto
    .createHash("sha256")
    .update(source)
    .digest("hex")
    .slice(0, 16);
}
