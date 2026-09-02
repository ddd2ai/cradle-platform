import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCodexProvider } from "../src/providers/codex-provider.js";

const testDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cradle-codex-media-test-"));
const commandPath = path.join(testDirectory, "fake-codex");
const capturePath = path.join(testDirectory, "capture.json");

try {
  await fs.writeFile(commandPath, `#!/usr/bin/env node
import fs from "node:fs";
const args = process.argv.slice(2);
const imageIndex = args.indexOf("--image");
fs.writeFileSync(process.env.CRADLE_CODEX_MEDIA_CAPTURE, JSON.stringify({
  args,
  cwd: process.cwd(),
  imagePath: args[imageIndex + 1],
  imageExists: fs.existsSync(args[imageIndex + 1]),
}));
process.stdout.write(JSON.stringify({
  type: "item.completed",
  item: { type: "agent_message", text: "observed" },
}) + "\\n");
`);
  await fs.chmod(commandPath, 0o700);
  process.env.CRADLE_CODEX_MEDIA_CAPTURE = capturePath;

  const provider = await createCodexProvider({
    command: commandPath,
    cwd: process.cwd(),
  });
  const answer = await provider.ask({
    prompt: "Observe this image",
    media: [{ mediaType: "image/png", data: Buffer.from("png-bytes") }],
  });
  const capture = JSON.parse(await fs.readFile(capturePath, "utf8"));

  assert.equal(answer, "observed");
  assert.equal(capture.imageExists, true);
  // macOS reports /private/var for process.cwd() while os.tmpdir() may return
  // the equivalent /var symlink, so compare the isolated directory identity.
  assert.equal(path.basename(capture.cwd), path.basename(path.dirname(capture.imagePath)));
  assert.notEqual(capture.cwd, process.cwd());
  assert.equal(capture.args.includes("--ephemeral"), true);
  assert.equal(capture.args.includes("--skip-git-repo-check"), true);
  assert.ok(capture.args.indexOf("Observe this image") < capture.args.indexOf("--image"));
  await assert.rejects(fs.access(capture.imagePath));
  await assert.rejects(fs.access(capture.cwd));
} finally {
  delete process.env.CRADLE_CODEX_MEDIA_CAPTURE;
  await fs.rm(testDirectory, { recursive: true, force: true });
}

console.log("Codex provider media tests passed");
