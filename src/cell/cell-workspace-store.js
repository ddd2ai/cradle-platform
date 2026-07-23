import fs from "fs/promises";
import path from "path";
import { resolveInsideRoot } from "../utils/safe-path.js";
import { writeTextFile } from "../utils/text-file.js";

export class CellWorkspaceStore {
  constructor({
    workspaceDir,
  } = {}) {
    if (!workspaceDir) {
      throw new Error("CellWorkspaceStore requires workspaceDir");
    }

    this.workspaceDir = workspaceDir;
  }

  async listWorkspace() {
    return await this.listDirectoryRecursive(this.workspaceDir);
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
}
