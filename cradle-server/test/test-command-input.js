import assert from "assert";
import { commandArgs, splitFirstArg } from "../src/commands/command-input.js";

assert.equal(commandArgs("/read notes/today.md", "/read"), "notes/today.md");
assert.equal(commandArgs("/heartbeat-mode", "/heartbeat-mode"), "");
assert.equal(commandArgs("/heartbeat-mode automatic", "/heartbeat-mode"), "automatic");

assert.deepEqual(splitFirstArg("/send cell-002 hello world", "/send"), {
  first: "cell-002",
  rest: "hello world",
});

assert.deepEqual(splitFirstArg("/send cell-002", "/send"), {
  first: "cell-002",
  rest: "",
});

assert.deepEqual(splitFirstArg("/produce java   build service", "/produce"), {
  first: "java",
  rest: "build service",
});

console.log("CommandInput tests passed");
