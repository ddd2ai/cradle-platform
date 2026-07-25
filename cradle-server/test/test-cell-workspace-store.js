import assert from "assert";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { CellWorkspaceStore } from "../src/cell/cell-workspace-store.js";

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "cradle-workspace-store-")
);
const workspaceDir = path.join(tempRoot, "workspace");
const store = new CellWorkspaceStore({ workspaceDir });

assert.deepEqual(await store.listWorkspace(), []);

await store.writeWorkspaceFile("notes/one.md", "one");
await store.writeWorkspaceFile("projects/app/index.js", "console.log('hi');");
await store.appendWorkspaceFile("notes/one.md", "two");
await store.writeWorkspaceFile("projects/app/large.txt", "a".repeat(110_000));
await store.writeWorkspaceFile("projects/app/archive.zip", "zip");
await fs.mkdir(path.join(workspaceDir, "empty"), { recursive: true });
await fs.mkdir(path.join(workspaceDir, ".git"), { recursive: true });
await fs.mkdir(path.join(workspaceDir, "node_modules"), { recursive: true });
await store.writeWorkspaceFile(".gitignore", "dist\n");
await store.writeWorkspaceFile(".DS_Store", "ignored");
const outsideFile = path.join(tempRoot, "outside.txt");
await fs.writeFile(outsideFile, "outside", "utf8");
try {
  await fs.symlink(outsideFile, path.join(workspaceDir, "outside-link.txt"));
} catch {
  // Some file systems or permission profiles do not allow symlink creation.
}

assert.equal(await store.readWorkspaceFile("notes/one.md"), "one\ntwo\n");
assert.deepEqual(await store.listWorkspace(), [
  ".DS_Store",
  ".git/",
  ".gitignore",
  "empty/",
  "node_modules/",
  "notes/",
  "notes/one.md",
  "outside-link.txt",
  "projects/",
  "projects/app/",
  "projects/app/archive.zip",
  "projects/app/index.js",
  "projects/app/large.txt",
]);

const metadata = await store.getWorkspaceMetadata();
assert.equal(metadata.path, workspaceDir);
assert.equal(metadata.exists, true);
assert.equal(metadata.readable, true);

const rootEntries = await store.listWorkspaceEntries("");
assert.deepEqual(
  rootEntries.map(({ name, type, hasChildren }) => ({ name, type, hasChildren })),
  [
    { name: "empty", type: "directory", hasChildren: false },
    { name: "notes", type: "directory", hasChildren: true },
    { name: "projects", type: "directory", hasChildren: true },
    { name: ".gitignore", type: "file", hasChildren: false },
  ]
);

const appEntries = await store.listWorkspaceEntries("projects/app");
assert.deepEqual(
  appEntries.map(({ name, type, mimeType, hasChildren }) => ({
    name,
    type,
    mimeType,
    hasChildren,
  })),
  [
    {
      name: "archive.zip",
      type: "file",
      mimeType: "application/zip",
      hasChildren: false,
    },
    {
      name: "index.js",
      type: "file",
      mimeType: "text/javascript",
      hasChildren: false,
    },
    {
      name: "large.txt",
      type: "file",
      mimeType: "text/plain",
      hasChildren: false,
    },
  ]
);

const preview = await store.readWorkspaceFilePreview("notes/one.md");
assert.equal(preview.name, "one.md");
assert.equal(preview.path, "notes/one.md");
assert.equal(preview.mimeType, "text/markdown");
assert.equal(preview.previewable, true);
assert.equal(preview.truncated, false);
assert.equal(preview.content, "one\ntwo\n");

const largePreview = await store.readWorkspaceFilePreview("projects/app/large.txt");
assert.equal(largePreview.previewable, true);
assert.equal(largePreview.truncated, true);
assert.equal(largePreview.content.length, 100_000);

const binaryPreview = await store.readWorkspaceFilePreview("projects/app/archive.zip");
assert.equal(binaryPreview.previewable, false);
assert.equal(binaryPreview.truncated, false);
assert.equal(binaryPreview.content, undefined);

const zip = await store.exportWorkspaceZip({ rootName: "cell-001-workspace" });
assert.equal(Buffer.isBuffer(zip), true);
const zipEntryNames = readZipLocalEntryNames(zip);
assert.ok(zipEntryNames.includes("cell-001-workspace/"));
assert.ok(zipEntryNames.includes("cell-001-workspace/notes/one.md"));
assert.ok(zipEntryNames.includes("cell-001-workspace/projects/app/index.js"));
assert.ok(zipEntryNames.includes("cell-001-workspace/.gitignore"));
assert.equal(zipEntryNames.some((name) => name.includes(".git/")), false);
assert.equal(zipEntryNames.some((name) => name.includes("node_modules/")), false);
assert.equal(zipEntryNames.some((name) => name.includes(".DS_Store")), false);
assert.equal(zipEntryNames.some((name) => name.includes("outside-link")), false);

const sections = await store.listWorkspaceSections();
assert.deepEqual(sections.notes, ["one.md"]);
assert.deepEqual(sections.projects, [
  "app/",
  "app/archive.zip",
  "app/index.js",
  "app/large.txt",
]);
assert.deepEqual(sections.tasks, []);

assert.throws(
  () => store.resolveInside(workspaceDir, "../outside.md"),
  /Invalid path outside cell directory/
);
await assert.rejects(
  () => store.listWorkspaceEntries("../outside"),
  /Invalid path outside cell directory/
);
await assert.rejects(
  () => store.listWorkspaceEntries(workspaceDir),
  /Invalid path outside cell directory/
);
assert.throws(
  () => new CellWorkspaceStore(),
  /requires workspaceDir/
);

await fs.rm(tempRoot, { recursive: true, force: true });

console.log("CellWorkspaceStore tests passed");

function readZipLocalEntryNames(buffer) {
  const names = [];
  let offset = 0;

  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    names.push(buffer.subarray(nameStart, nameEnd).toString("utf8"));
    offset = nameEnd + extraLength + compressedSize;
  }

  return names;
}
