import { spawn } from "node:child_process";

export async function createCodexProvider({
  model = null,
  command = "codex",
  cwd = process.cwd(),
  timeoutMs = 300_000,
} = {}) {
  return {
    name: "codex",
    model: model ?? "auto",

    async ask({
      prompt,
      onDelta,
      onIdle,
      onError,
    } = {}) {
      if (
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        const error = new Error(
          "CodexProvider.ask() requires a non-empty prompt"
        );

        onError?.(error);
        throw error;
      }

      try {
        const args = [
          "exec",
          "--json",
        ];

        /*
         * model 為 null、undefined 或 auto 時，
         * 不傳 --model，交給 Codex CLI 自動選擇。
         */
        if (
          typeof model === "string" &&
          model.trim() &&
          model.trim().toLowerCase() !== "auto"
        ) {
          args.push(
            "--model",
            model.trim()
          );
        }

        args.push(prompt);

        const answer = await executeCodex({
          command,
          args,
          cwd,
          timeoutMs,
          onDelta,
        });

        if (!answer.trim()) {
          throw new Error(
            "Codex CLI returned an empty response"
          );
        }

        onIdle?.();

        return answer;
      } catch (error) {
        onError?.(error);
        throw error;
      }
    },

    async cleanup() {
      // 每次 ask 都是獨立 Codex process，沒有長連線要清理。
    },
  };
}

function executeCodex({
  command,
  args,
  cwd,
  timeoutMs,
  onDelta,
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

    let stdoutBuffer = "";
    let stderr = "";
    let answer = "";
    let settled = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    const finish = (callback) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      callback();
    };

    const handleLine = (line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return;
      }

      let event;

      try {
        event = JSON.parse(trimmed);
      } catch (error) {
        throw new Error(
          `Codex CLI returned invalid JSONL line:\n${trimmed}`,
          { cause: error }
        );
      }

      if (
        event.type === "item.completed" &&
        event.item?.type === "agent_message" &&
        typeof event.item.text === "string"
      ) {
        const text = event.item.text;

        answer += text;
        onDelta?.(text);
      }

      if (event.type === "turn.failed") {
        throw new Error(
          event.error?.message ??
          "Codex CLI turn failed"
        );
      }
    };

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;

      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";

      try {
        for (const line of lines) {
          handleLine(line);
        }
      } catch (error) {
        child.kill("SIGTERM");

        finish(() => {
          reject(error);
        });
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");

      finish(() => {
        reject(
          new Error(
            `Codex CLI timed out after ${timeoutMs} ms`
          )
        );
      });
    }, timeoutMs);

    child.on("error", (error) => {
      finish(() => {
        reject(
          new Error(
            `Unable to start Codex CLI: ${error.message}`,
            { cause: error }
          )
        );
      });
    });

    child.on("close", (exitCode, signal) => {
      if (settled) {
        return;
      }

      try {
        if (stdoutBuffer.trim()) {
          handleLine(stdoutBuffer);
        }
      } catch (error) {
        finish(() => {
          reject(error);
        });

        return;
      }

      finish(() => {
        if (exitCode !== 0) {
          reject(
            new Error(
              [
                "Codex CLI execution failed",
                `Exit code: ${exitCode}`,
                `Signal: ${signal ?? "none"}`,
                stderr.trim()
                  ? `stderr:\n${stderr.trim()}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n")
            )
          );

          return;
        }

        resolve(answer.trim());
      });
    });
  });
}