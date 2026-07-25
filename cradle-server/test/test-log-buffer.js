import assert from "assert";
import { installConsoleLogBuffer, LogBuffer } from "../src/application/log-buffer.js";

const logBuffer = new LogBuffer({
  limit: 2,
  now: () => new Date("2026-07-25T10:31:21.000Z"),
});

logBuffer.append({ level: "info", args: ["cell-%s tick", "001"] });
logBuffer.append({ level: "warn", args: ["cell-003 idle"] });
logBuffer.append({ level: "error", args: [new Error("Build failed")] });

assert.equal(logBuffer.list().length, 2);
assert.equal(logBuffer.list()[0].message, "cell-003 idle");
assert.equal(logBuffer.list()[1].level, "error");
assert.ok(logBuffer.list()[1].message.includes("Build failed"));

logBuffer.clear();
assert.deepEqual(logBuffer.list(), []);

const output = [];
const fakeConsole = {
  log: (...args) => output.push(["log", args]),
  info: (...args) => output.push(["info", args]),
  warn: (...args) => output.push(["warn", args]),
  error: (...args) => output.push(["error", args]),
};
const installed = installConsoleLogBuffer({
  logBuffer,
  consoleObject: fakeConsole,
});

fakeConsole.log("Heartbeat completed");
fakeConsole.warn("cell-003 idle");

assert.deepEqual(
  logBuffer.list().map((entry) => ({
    level: entry.level,
    message: entry.message,
  })),
  [
    { level: "info", message: "Heartbeat completed" },
    { level: "warn", message: "cell-003 idle" },
  ],
);
assert.deepEqual(output, [
  ["log", ["Heartbeat completed"]],
  ["warn", ["cell-003 idle"]],
]);

installed.restore();
fakeConsole.log("restored");
assert.equal(logBuffer.list().length, 2);
assert.deepEqual(output[2], ["log", ["restored"]]);

console.log("LogBuffer tests passed");
