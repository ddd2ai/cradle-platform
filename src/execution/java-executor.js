import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { ExecutionResult } from "./execution-result.js";

/**
 * JavaExecutor
 * 
 * 負責編譯與執行 Java 程式碼
 * 
 * 流程:
 * 1. 建立 sandbox execution 目錄
 * 2. 複製 .java 檔案到 execution 目錄
 * 3. 執行 javac 編譯
 * 4. 執行 java
 * 5. 收集 stdout / stderr / exitCode
 * 6. 產生 execution-result.json
 */
export class JavaExecutor {
  constructor({ executionsDir }) {
    this.executionsDir = executionsDir;
  }

  async execute({ artifact }) {
    const javaOutputs = artifact.outputs.filter((output) =>
      output.path?.endsWith(".java")
    );

    if (javaOutputs.length === 0) {
      throw new Error("No Java outputs found in artifact.");
    }

    if (javaOutputs.length > 1) {
      throw new Error(
        `Executable Java artifact must contain exactly one .java file. Found: ${javaOutputs.length}`
      );
    }

    const executionId = `execution-${Date.now()}`;
    const executionDir = path.resolve(this.executionsDir, executionId);
    const srcDir = path.join(executionDir, "src");

    await fs.mkdir(srcDir, { recursive: true });

    const output = javaOutputs[0];
    const fileName = path.basename(output.path);
    const mainClass = path.basename(fileName, ".java");
    const filePath = path.join(srcDir, fileName);

    await fs.writeFile(filePath, output.content, "utf8");

    // 執行 javac 編譯
    const compileCommand = `javac ${fileName}`;
    const compile = await this.runCommand("javac", [fileName], {
      cwd: srcDir,
    });

    if (compile.exitCode !== 0) {
      const result = ExecutionResult.createCompileFailed({
        artifactId: artifact.id,
        command: compileCommand,
        stderr: compile.stderr,
        executionId,
      });

      await this.writeResult(executionDir, result);
      return result;
    }

    // 執行 java
    const runCommand = `java -cp src ${mainClass}`;
    const run = await this.runCommand("java", ["-cp", srcDir, mainClass], {
      cwd: executionDir,
    });

    const result =
      run.exitCode === 0
        ? ExecutionResult.createPassed({
            artifactId: artifact.id,
            command: runCommand,
            stdout: run.stdout,
            exitCode: run.exitCode,
            executionId,
          })
        : ExecutionResult.createRuntimeFailed({
            artifactId: artifact.id,
            command: runCommand,
            stdout: run.stdout,
            stderr: run.stderr,
            exitCode: run.exitCode,
            executionId,
          });

    await this.writeResult(executionDir, result);
    return result;
  }

  runCommand(command, args, options = {}) {
    return new Promise((resolve) => {
      const child = spawn(command, args, options);

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (exitCode) => {
        resolve({
          exitCode,
          stdout,
          stderr,
        });
      });

      child.on("error", (error) => {
        resolve({
          exitCode: 1,
          stdout,
          stderr: error.message,
        });
      });
    });
  }

  async writeResult(executionDir, result) {
    const output = result.toJSON();

    await fs.writeFile(
      path.join(executionDir, "execution-result.json"),
      JSON.stringify(output, null, 2),
      "utf8"
    );

    return output;
  }
}
