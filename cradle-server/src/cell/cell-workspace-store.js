import { constants as fsConstants } from "fs";
import fs from "fs/promises";
import path from "path";
import { resolveInsideRoot } from "../utils/safe-path.js";
import { writeTextFile } from "../utils/text-file.js";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "target",
  "build",
  "dist",
  ".idea",
]);
const IGNORED_FILES = new Set([".DS_Store"]);
const MAX_PREVIEW_BYTES = 1024 * 1024;
const MAX_PREVIEW_CHARS = 100_000;
const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/yaml",
  "text/css",
  "text/html",
  "text/javascript",
  "text/markdown",
  "text/plain",
  "text/typescript",
  "text/x-java-source",
]);

export class CellWorkspaceStore {
  constructor({
    workspaceDir,
  } = {}) {
    if (!workspaceDir) {
      throw new Error("CellWorkspaceStore requires workspaceDir");
    }

    this.workspaceDir = workspaceDir;
  }

  async getWorkspaceMetadata() {
    const exists = await pathExists(this.workspaceDir);
    const readable = exists ? await isReadable(this.workspaceDir) : false;

    return {
      path: this.workspaceDir,
      exists,
      readable,
    };
  }

  async listWorkspace() {
    return await this.listDirectoryRecursive(this.workspaceDir);
  }

  async listWorkspaceEntries(relativePath = "") {
    const normalizedPath = normalizeWorkspacePath(relativePath);
    const directory = await this.resolveExistingInside(normalizedPath);
    const directoryStat = await fs.stat(directory);

    if (!directoryStat.isDirectory()) {
      throw new Error(`Workspace path is not a directory: ${normalizedPath}`);
    }

    const entries = await fs.readdir(directory, { withFileTypes: true });
    const mappedEntries = [];

    for (const entry of entries) {
      if (shouldIgnoreEntry(entry)) {
        continue;
      }

      const entryPath = normalizedPath
        ? path.posix.join(normalizedPath, entry.name)
        : entry.name;
      const fullPath = path.join(directory, entry.name);
      const mapped = await this.mapWorkspaceEntry(entry, fullPath, entryPath);

      if (mapped) {
        mappedEntries.push(mapped);
      }
    }

    return mappedEntries.sort(compareWorkspaceEntries);
  }

  async listWorkspaceSections() {
    const sections = [
      "notes",
      "tasks",
      "artifacts",
      "projects",
      "research",
      "decisions",
    ];

    const result = {};

    for (const section of sections) {
      const sectionDir = path.join(this.workspaceDir, section);
      result[section] = await this.listDirectoryRecursive(sectionDir, sectionDir);
    }

    return result;
  }

  async writeWorkspaceFile(relativePath, content) {
    const file = this.resolveInside(this.workspaceDir, relativePath);
    await writeTextFile(file, content);
  }

  async readWorkspaceFile(relativePath) {
    const file = this.resolveInside(this.workspaceDir, relativePath);
    return await fs.readFile(file, "utf8");
  }

  async readWorkspaceFilePreview(relativePath) {
    const normalizedPath = normalizeWorkspacePath(relativePath);

    if (!normalizedPath) {
      throw new Error("Workspace file path is required");
    }

    const file = await this.resolveExistingInside(normalizedPath);
    const stat = await fs.stat(file);

    if (!stat.isFile()) {
      throw new Error(`Workspace path is not a file: ${normalizedPath}`);
    }

    const mimeType = resolveMimeType(normalizedPath);
    const base = {
      name: path.posix.basename(normalizedPath),
      path: normalizedPath,
      mimeType,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      truncated: false,
      previewable: isPreviewableMimeType(mimeType),
    };

    if (!base.previewable) {
      return base;
    }

    const previewBuffer = Buffer.alloc(Math.min(stat.size, MAX_PREVIEW_BYTES));
    const handle = await fs.open(file, "r");

    try {
      const { bytesRead } = await handle.read({
        buffer: previewBuffer,
        offset: 0,
        length: previewBuffer.length,
        position: 0,
      });
      let content = previewBuffer.subarray(0, bytesRead).toString("utf8");
      let truncated = stat.size > bytesRead;

      if (content.length > MAX_PREVIEW_CHARS) {
        content = content.slice(0, MAX_PREVIEW_CHARS);
        truncated = true;
      }

      return {
        ...base,
        encoding: "utf-8",
        content,
        truncated,
      };
    } finally {
      await handle.close();
    }
  }

  async appendWorkspaceFile(relativePath, content) {
    const file = this.resolveInside(this.workspaceDir, relativePath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, `\n${content}\n`, "utf8");
  }

  async listDirectoryRecursive(dir, baseDir = dir) {
    const result = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          result.push(`${relativePath}/`);
          result.push(...(await this.listDirectoryRecursive(fullPath, baseDir)));
        } else {
          result.push(relativePath);
        }
      }
    } catch {
      return result;
    }

    return result;
  }

  resolveInside(baseDir, relativePath) {
    return resolveInsideRoot(baseDir, relativePath, {
      errorMessage: (input) => `Invalid path outside cell directory: ${input}`,
    });
  }

  async resolveExistingInside(relativePath) {
    const target = this.resolveInside(this.workspaceDir, relativePath);
    const rootRealPath = await fs.realpath(this.workspaceDir);
    const targetRealPath = await fs.realpath(target);

    if (!isPathInside(rootRealPath, targetRealPath)) {
      throw new Error(`Invalid path outside cell directory: ${relativePath}`);
    }

    return targetRealPath;
  }

  async mapWorkspaceEntry(entry, fullPath, relativePath) {
    let stat;
    let type;

    if (entry.isSymbolicLink()) {
      try {
        const rootRealPath = await fs.realpath(this.workspaceDir);
        const targetRealPath = await fs.realpath(fullPath);

        if (!isPathInside(rootRealPath, targetRealPath)) {
          return null;
        }

        stat = await fs.stat(targetRealPath);
      } catch {
        return null;
      }
    } else {
      stat = await fs.stat(fullPath);
    }

    if (stat.isDirectory()) {
      type = "directory";
    } else if (stat.isFile()) {
      type = "file";
    } else {
      return null;
    }

    return {
      name: entry.name,
      path: relativePath,
      type,
      size: type === "file" ? stat.size : null,
      mimeType: type === "file" ? resolveMimeType(relativePath) : undefined,
      modifiedAt: stat.mtime.toISOString(),
      hasChildren: type === "directory"
        ? await directoryHasVisibleChildren(fullPath)
        : false,
    };
  }
}

function normalizeWorkspacePath(input) {
  const relativePath = String(input ?? "").trim();

  if (!relativePath) {
    return "";
  }

  if (path.isAbsolute(relativePath)) {
    throw new Error(`Invalid path outside cell directory: ${relativePath}`);
  }

  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));

  if (normalized === "." || normalized === "") {
    return "";
  }

  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Invalid path outside cell directory: ${relativePath}`);
  }

  return normalized;
}

function isPathInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function isReadable(target) {
  try {
    await fs.access(target, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function shouldIgnoreEntry(entry) {
  if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
    return true;
  }

  return IGNORED_FILES.has(entry.name);
}

async function directoryHasVisibleChildren(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries.some((entry) => !shouldIgnoreEntry(entry));
  } catch {
    return false;
  }
}

function compareWorkspaceEntries(left, right) {
  if (left.type !== right.type) {
    return left.type === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function resolveMimeType(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();

  switch (extension) {
    case ".css":
      return "text/css";
    case ".html":
    case ".htm":
      return "text/html";
    case ".java":
      return "text/x-java-source";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "text/javascript";
    case ".json":
      return "application/json";
    case ".md":
    case ".markdown":
      return "text/markdown";
    case ".ts":
    case ".tsx":
      return "text/typescript";
    case ".xml":
      return "application/xml";
    case ".yaml":
    case ".yml":
      return "application/yaml";
    case ".txt":
    case ".log":
    case ".csv":
      return "text/plain";
    case ".zip":
      return "application/zip";
    case ".jar":
      return "application/java-archive";
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function isPreviewableMimeType(mimeType) {
  return TEXT_MIME_TYPES.has(mimeType);
}
