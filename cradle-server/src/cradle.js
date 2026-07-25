#!/usr/bin/env node

import { CradleEngine } from "./cradle-engine.js";
import {
  getAiDefaultModel,
  getAiDefaultProvider,
  getAiTimeoutSeconds,
  getHeartbeatMode,
} from "./cradle-config.js";

const BUILT_IN_DEFAULT_PROVIDER = "ollama";

const DEFAULT_MODELS = Object.freeze({
  ollama: "devstral-small-2:24b",
  copilot: "gpt-5-mini",
  gemini: "auto",
  codex: "auto",
});

let cli;

try {
  cli = parseCliArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  printHelp();
  process.exit(1);
}

if (cli.help) {
  printHelp();
  process.exit(0);
}

if (cli.command !== "start") {
  console.error(`Unsupported command: ${cli.command}`);
  printHelp();
  process.exit(1);
}

const provider =
  cli.provider ??
  process.env.PROVIDER ??
  getAiDefaultProvider() ??
  BUILT_IN_DEFAULT_PROVIDER;

const model =
  cli.model ??
  process.env.MODEL ??
  getAiDefaultModel() ??
  DEFAULT_MODELS[provider];

if (!model) {
  throw new Error(
    `No default model configured for provider: ${provider}`
  );
}

const engine = new CradleEngine({
  provider,
  model,
  timeoutSeconds: getAiTimeoutSeconds(),
  heartbeatMode: getHeartbeatMode() ?? "manual",
});

await engine.start();

function parseCliArgs(args) {
  const result = {
    command: "start",
    provider: null,
    model: null,
    help: false,
  };

  const tokens = [...args];

  if (
    tokens[0] &&
    !tokens[0].startsWith("-")
  ) {
    result.command = tokens.shift();
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (
      token === "--help" ||
      token === "-h"
    ) {
      result.help = true;
      continue;
    }

    if (token.startsWith("--provider=")) {
      result.provider =
        readInlineOption(token, "--provider=");
      continue;
    }

    if (token === "--provider") {
      result.provider = readOptionValue(
        tokens,
        index,
        "--provider"
      );
      index += 1;
      continue;
    }

    if (token.startsWith("--model=")) {
      result.model =
        readInlineOption(token, "--model=");
      continue;
    }

    if (token === "--model") {
      result.model = readOptionValue(
        tokens,
        index,
        "--model"
      );
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return result;
}

function readInlineOption(token, prefix) {
  const value = token.slice(prefix.length).trim();

  if (!value) {
    throw new Error(`Missing value for ${prefix.slice(0, -1)}`);
  }

  return value;
}

function readOptionValue(tokens, index, optionName) {
  const value = tokens[index + 1];

  if (
    !value ||
    value.startsWith("-")
  ) {
    throw new Error(`Missing value for ${optionName}`);
  }

  return value;
}

function printHelp() {
  console.log(`
Usage:
  cradle start [--provider <provider>] [--model <model>]

Examples:
  cradle start
  cradle start --provider codex
  cradle start --provider ollama --model devstral-small-2:24b

Fallback order:
  CLI argument -> environment variable -> cradle-config.json -> built-in default
`);
}
