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

assertValidOutputs({
  type: "config",
  outputs: [
    output({ path: ".env", language: "env", content: "CRADLE_MODE=production" }),
    output({ path: "service.yaml", language: "yaml", content: "mode: production" }),
  ],
});

assertValidOutputs({
  type: "image",
  outputs: [
    output({
      path: "brand/cradle.svg",
      language: "svg",
      content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="#6ee7a8"/></svg>',
    }),
  ],
});

assertInvalidOutputs(
  {
    type: "image",
    outputs: [
      output({
        path: "unsafe.svg",
        language: "svg",
        content: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      }),
    ],
  },
  /active or external content/,
);

assertInvalidOutputs(
  {
    type: "image",
    outputs: [
      output({
        path: "fake.md",
        language: "markdown",
        content: "# A picture description",
      }),
    ],
  },
  /Invalid output language/,
);

console.log("Artifact validation tests passed");
