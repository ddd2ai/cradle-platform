import fs from "fs/promises";
import path from "path";

export const DEFAULT_DNA_DEFINITIONS = Object.freeze([
  { name: "PERCEPTION", fileName: "perception.md" },
  { name: "DECISION", fileName: "decision.md" },
  { name: "DECOMPOSITION", fileName: "decomposition.md" },
  { name: "LEARNING", fileName: "learning.md" },
  { name: "COLLABORATION", fileName: "collaboration.md" },
  { name: "CREATION", fileName: "creation.md" },
  { name: "EVOLUTION", fileName: "evolution.md" },
]);

export const DEFAULT_DNA_FACTORS = Object.freeze([
  "strength",
  "stability",
  "plasticity",
]);

export const DEFAULT_VISION = `# VISION

建立一套電商系統。
`;

export const DEFAULT_ENVIRONMENT = `# ENVIRONMENT

- Java 21
- Spring Boot
- Hexagonal Architecture
- MariaDB
`;

export class CellConfigStore {
  constructor({
    dnaDefinitionFile,
    dnaFactorsFile,
    visionFile,
    environmentFile,
    dnaDir,
  } = {}) {
    if (!dnaDefinitionFile) {
      throw new Error("CellConfigStore requires dnaDefinitionFile");
    }

    if (!dnaFactorsFile) {
      throw new Error("CellConfigStore requires dnaFactorsFile");
    }

    if (!visionFile) {
      throw new Error("CellConfigStore requires visionFile");
    }

    if (!environmentFile) {
      throw new Error("CellConfigStore requires environmentFile");
    }

    if (!dnaDir) {
      throw new Error("CellConfigStore requires dnaDir");
    }

    this.dnaDefinitionFile = dnaDefinitionFile;
    this.dnaFactorsFile = dnaFactorsFile;
    this.visionFile = visionFile;
    this.environmentFile = environmentFile;
    this.dnaDir = dnaDir;
  }

  async readDNADefinition() {
    try {
      const content = await fs.readFile(this.dnaDefinitionFile, "utf8");
      const matches = [...content.matchAll(/^##\s+([A-Z0-9_-]+)\s*$/gm)];

      return matches.map((match) => {
        const name = match[1].trim();

        return {
          name,
          fileName: `${name.toLowerCase()}.md`,
        };
      });
    } catch {
      return [...DEFAULT_DNA_DEFINITIONS];
    }
  }

  async getDNAFiles() {
    const definitions = await this.readDNADefinition();

    return Object.fromEntries(
      definitions.map((definition) => [
        definition.name,
        path.join(this.dnaDir, definition.fileName),
      ])
    );
  }

  async readDNAFactors() {
    try {
      const content = await fs.readFile(this.dnaFactorsFile, "utf8");
      const matches = [...content.matchAll(/^##\s+([a-zA-Z0-9_-]+)\s*$/gm)];

      return matches.map((match) => match[1].trim());
    } catch {
      return [...DEFAULT_DNA_FACTORS];
    }
  }

  async ensureRootFiles() {
    await this.ensureFile(this.visionFile, DEFAULT_VISION);
    await this.ensureFile(this.environmentFile, DEFAULT_ENVIRONMENT);
  }

  async prepareDNAFiles() {
    const definitions = await this.readDNADefinition();

    for (const definition of definitions) {
      const file = path.join(this.dnaDir, definition.fileName);
      await this.ensureFile(file, this.createDNASeed(definition.name));
    }
  }

  createDNASeed(name) {
    return `# ${name} DNA

## Meaning

TODO: define meaning from DNA_DEFINITION.md.

## Traits

- TODO: define traits.

## Vector

\`\`\`json
{
  "strength": 0.5,
  "stability": 0.7,
  "plasticity": 0.3
}
\`\`\`
`;
  }

  async readVision() {
    try {
      return await fs.readFile(this.visionFile, "utf8");
    } catch {
      return "# VISION\n\n建立一套電商系統。";
    }
  }

  async readEnvironment() {
    try {
      return await fs.readFile(this.environmentFile, "utf8");
    } catch {
      return "# ENVIRONMENT\n\n- Java 21\n- Spring Boot\n- Hexagonal Architecture\n- MariaDB";
    }
  }

  async ensureFile(file, content = "") {
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(file, content, "utf8");
    }
  }
}
