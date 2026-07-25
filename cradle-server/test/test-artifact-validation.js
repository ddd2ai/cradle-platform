#!/usr/bin/env node

import assert from "node:assert/strict";

import { ArtifactValidator } from "../src/production/artifact-validator.js";

const validator = new ArtifactValidator();

function output({ path, language, content }) {
  return {
    kind: "file",
    path,
    language,
    content,
  };
}

function assertValidOutputs(artifact) {
  assert.doesNotThrow(() => validator.validateOutputs(artifact));
}

function assertInvalidOutputs(artifact, pattern) {
  assert.throws(() => validator.validateOutputs(artifact), pattern);
}

console.log("Testing artifact output validation...");

assertValidOutputs({
  type: "document",
  outputs: [
    output({
      path: "design.md",
      language: "markdown",
      content: "# Design\n\nValid markdown.",
    }),
    output({
      path: "readme.md",
      language: "markdown",
      content: "# README\n\nValid markdown.",
    }),
  ],
});

assertInvalidOutputs(
  {
    type: "document",
    outputs: [
      output({
        path: "design.md",
        language: "markdown",
        content: "# Design\n\nValid markdown.",
      }),
      output({
        path: "src/main/java/App.java",
        language: "java",
        content: "public class App {}",
      }),
    ],
  },
  /Invalid output language/
);

assertValidOutputs({
  type: "code",
  outputs: [
    output({
      path: "src/App.java",
      language: "java",
      content: "public class App {}",
    }),
    output({
      path: "config.yaml",
      language: "yaml",
      content: "name: cradle",
    }),
    output({
      path: "README.md",
      language: "markdown",
      content: "# README",
    }),
  ],
});

assertValidOutputs({
  type: "generic",
  outputs: [
    output({
      path: "anything.txt",
      language: "text",
      content: "anything",
    }),
    output({
      path: "whatever.xyz",
      language: "unknown",
      content: "whatever",
    }),
  ],
});

console.log("Artifact validation tests passed");
