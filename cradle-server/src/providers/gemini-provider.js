import { spawn } from "node:child_process";
import { getProviderTimeoutMs } from "../cradle-config.js";
import { PROJECT_ROOT } from "../project-root.js";
import { abortReason } from "./provider-request-control.js";

/**
 * 建立 Gemini CLI Provider
 *
 * Gemini CLI 必須已安裝並完成認證：
 *
 *   gemini --version
 *   gemini -p "test" --output-format json
 */
export async function createGeminiProvider({
  model = null,
  command = "gemini",
  cwd = PROJECT_ROOT,
  timeoutMs = getProviderTimeoutMs("gemini"),
} = {}) {
  return {
    name: "gemini-cli",
    model: model || "auto",
    capabilities: { mediaInput: false },

    async ask({
      prompt,
      onDelta,
      onIdle,
      onError,
      timeoutMs: requestTimeoutMs = timeoutMs,
      signal,
    }) {
      if (typeof prompt !== "string" || !prompt.trim()) {
        const error = new Error(
          "GeminiProvider.ask() requires a non-empty prompt"
        );

        onError?.(error);
        throw error;
      }

      try {
        const args = [
          "--prompt",
          prompt,
          "--output-format",
          "json",
        ];

        if (model) {
          args.push("--model", model);
        }

        const { stdout } = await executeGemini({
          command,
          args,
          cwd,
          timeoutMs: requestTimeoutMs,
          signal,
        });

        const payload = parseGeminiResponse(stdout);

        if (payload.error) {
          throw new Error(
            payload.error.message ||
            JSON.stringify(payload.error)
          );
        }

        const answer = payload.response?.trim();

        if (!answer) {
          throw new Error(
            "Gemini CLI returned an empty response"
          );
        }

        /*
         * JSON 模式會在完成後一次回傳完整內容，
         * 因此第一版先將完整回答當成一個 chunk。
         */
        onDelta?.(answer);
        onIdle?.();

        return answer;
      } catch (error) {
        onError?.(error);
        throw error;
      }
    },

    async cleanup() {
      // 每次 ask 都是獨立 CLI process，沒有長連線需要清理。
    },
  };
}

function executeGemini({
  command,
  args,
  cwd,
  timeoutMs,
  signal,
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let terminationError = null;
    let timer = null;
    let forceKillTimer = null;
    let stopFallbackTimer = null;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const finish = (callback) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      clearTimeout(forceKillTimer);
      clearTimeout(stopFallbackTimer);
      signal?.removeEventListener("abort", handleAbort);
      callback();
    };

    const requestStop = (error) => {
      if (settled || terminationError) return;
      terminationError = error;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 250);
      forceKillTimer.unref?.();
      stopFallbackTimer = setTimeout(() => finish(() => reject(error)), 1_000);
      stopFallbackTimer.unref?.();
    };

    const handleAbort = () => requestStop(abortReason(signal));
    if (signal?.aborted) handleAbort();
    else signal?.addEventListener("abort", handleAbort, { once: true });

    timer = setTimeout(() => {
      requestStop(new Error(`Gemini CLI timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    timer.unref?.();

    child.on("error", (error) => {
      finish(() => {
        reject(
          new Error(
            `Unable to start Gemini CLI: ${error.message}`,
            { cause: error }
          )
        );
      });
    });

    child.on("close", (exitCode, signal) => {
      finish(() => {
        if (terminationError) {
          reject(terminationError);
          return;
        }
        if (exitCode !== 0) {
          reject(
            new Error(
              [
                "Gemini CLI execution failed",
                `Exit code: ${exitCode}`,
                `Signal: ${signal || "none"}`,
                stderr.trim()
                  ? `stderr:\n${stderr.trim()}`
                  : "",
                stdout.trim()
                  ? `stdout:\n${stdout.trim()}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n")
            )
          );

          return;
        }

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });
    });
  });
}

function parseGeminiResponse(stdout) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Gemini CLI returned invalid JSON:\n${stdout}`,
      { cause: error }
    );
  }
}
