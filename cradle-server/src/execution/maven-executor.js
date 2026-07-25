import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { ExecutionResult } from "./execution-result.js";
import { getTimeoutMs } from "../cradle-config.js";
import { resolveInsideRoot } from "../utils/safe-path.js";
import { writeTextFile } from "../utils/text-file.js";

export class MavenExecutor {
  constructor({
    executionsDir,
    timeoutMs = getTimeoutMs("mavenExecutionSeconds"),
  } = {}) {
    if (!executionsDir) {
      throw new Error("MavenExecutor requires executionsDir");
    }

    this.executionsDir = executionsDir;
    this.timeoutMs = timeoutMs;
  }

  /**
   * 執行 Maven Artifact。
   *
   * 第一版只執行 Maven build，不啟動 Spring Boot。
   */
  async execute({ artifact } = {}) {
    const executionId = `execution-${Date.now()}`;
    const startedAt = new Date().toISOString();

    try {
      this.validateArtifact(artifact);

      const workspaceDir = path.join(
        this.executionsDir,
        executionId,
        "workspace"
      );

      await fs.mkdir(workspaceDir, {
        recursive: true,
      });

      await this.writeArtifactOutputs({
        artifact,
        workspaceDir,
      });

      const command = await this.resolveMavenCommand(
        workspaceDir
      );

      const args = [
        "clean",
        "package",
        "-DskipTests",
      ];

      const processResult = await this.runCommand({
        command,
        args,
        cwd: workspaceDir,
        timeoutMs: this.timeoutMs,
      });

      if (processResult.exitCode !== 0) {
        throw new Error(
          [
            "Maven build failed",
            "",
            `Command: ${command} ${args.join(" ")}`,
            `Exit code: ${processResult.exitCode}`,
            "",
            "STDOUT:",
            processResult.stdout || "(empty)",
            "",
            "STDERR:",
            processResult.stderr || "(empty)",
          ].join("\n")
        );
      }

      return ExecutionResult.createPassed({
        artifactId: artifact.id,
        executionId,
        command: `${command} ${args.join(" ")}`,
        output: [
          processResult.stdout,
          processResult.stderr,
        ]
          .filter(Boolean)
          .join("\n")
          .trim(),
        createdAt: startedAt,
      });
    } catch (error) {
      return ExecutionResult.createError({
        artifactId: artifact?.id,
        executionId,
        error,
        createdAt: startedAt,
      });
    }
  }

  validateArtifact(artifact) {
    if (!artifact) {
      throw new Error("MavenExecutor requires artifact");
    }

    const outputs = artifact.outputs ?? [];

    const hasPom = outputs.some(
      output =>
        output.kind === "file" &&
        output.path === "pom.xml"
    );

    if (!hasPom) {
      throw new Error(
        "Maven artifact must contain pom.xml"
      );
    }

    if (outputs.length === 0) {
      throw new Error(
        "Maven artifact must contain outputs"
      );
    }
  }

  async writeArtifactOutputs({
    artifact,
    workspaceDir,
  }) {
    for (const output of artifact.outputs ?? []) {
      if (output.kind !== "file") {
        continue;
      }

      const outputPath = this.resolveSafePath(
        workspaceDir,
        output.path
      );

      await writeTextFile(outputPath, output.content ?? "");
    }
  }

  resolveSafePath(workspaceDir, relativePath) {
    return resolveInsideRoot(workspaceDir, relativePath, {
      errorMessage: (input) => `Artifact output escapes workspace: ${input}`,
    });
  }

  /**
   * 專案有 Maven Wrapper 時優先使用 wrapper，
   * 否則使用系統 mvn。
   */
  async resolveMavenCommand(workspaceDir) {
    const wrapperPath = path.join(
      workspaceDir,
      "mvnw"
    );

    try {
      await fs.access(wrapperPath);

      await fs.chmod(wrapperPath, 0o755);

      return "./mvnw";
    } catch {
      return "mvn";
    }
  }

  runCommand({
    command,
    args,
    cwd,
    timeoutMs,
  }) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        shell: false,
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;

        settled = true;
        child.kill("SIGTERM");

        setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL");
          }
        }, 3000).unref();

        reject(
          new Error(
            `Maven execution timed out after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);

      child.stdout.on("data", chunk => {
        const text = chunk.toString();

        stdout += text;
        process.stdout.write(text);
      });

      child.stderr.on("data", chunk => {
        const text = chunk.toString();

        stderr += text;
        process.stderr.write(text);
      });

      child.on("error", error => {
        if (settled) return;

        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", exitCode => {
        if (settled) return;

        settled = true;
        clearTimeout(timer);

        resolve({
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });
    });
  }
}
