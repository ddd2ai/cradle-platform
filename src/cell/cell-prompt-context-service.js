import fs from "fs/promises";

export class CellPromptContextService {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellPromptContextService requires cell");
    }

    this.cell = cell;
  }

  async readDNAContext() {
    const dnaFiles = await this.cell.getDNAFiles();
    const contents = [];

    for (const [key, file] of Object.entries(dnaFiles)) {
      try {
        const content = await fs.readFile(file, "utf8");
        contents.push(`# ${key}\n\n${content}`);
      } catch {
        // skip missing DNA file
      }
    }

    const vector = await this.cell.readDNAVector();

    if (vector) {
      contents.push(`# DNA Vector\n\n\`\`\`json\n${JSON.stringify(vector, null, 2)}\n\`\`\``);
    }

    return contents.join("\n\n---\n\n");
  }

  async buildMemoryContext(input = "") {
    const identity = await this.cell.safeReadMemory("identity");
    const rules = await this.cell.safeReadMemory("rules");
    const knowledge = await this.cell.safeReadMemory("knowledge");
    const recentHistory = await this.cell.readRecentHistory(8000);
    const recentThoughts = await this.cell.readRecentThoughts(4000);
    const dnaContext = await this.readDNAContext();
    const vision = await this.cell.readVision();
    const environment = await this.cell.readEnvironment();

    return `
    ## DNA

    ${dnaContext}

    ---

    ## Vision

    ${vision}

    ---

    ## Environment

    ${environment}

    ---

    ## Identity

    ${identity}

    ---

    ## Rules

    ${rules}

    ---

    ## Knowledge

    ${knowledge}

    ---

    ## Recent History

    ${recentHistory}

    ---

    ## Recent Thoughts

    ${recentThoughts}

    ---

    ## Current Task Hint

    ${input}
    `;
  }

  async readMemoryContext() {
    return await this.buildMemoryContext();
  }

  async buildCellSystemPrompt() {
    const vision = await this.cell.safeReadFile(this.cell.visionFile, "# VISION\n\n(empty)");
    const environment = await this.cell.safeReadFile(this.cell.environmentFile, "# ENVIRONMENT\n\n(empty)");
    const dnaDefinition = await this.cell.safeReadFile(this.cell.dnaDefinitionFile, "# DNA_DEFINITION\n\n(empty)");
    const dnaFactors = await this.cell.safeReadFile(this.cell.dnaFactorsFile, "# DNA_FACTORS\n\n(empty)");

    const identity = await this.cell.safeReadMemory("identity");
    const rules = await this.cell.safeReadMemory("rules");
    const knowledge = await this.cell.safeReadMemory("knowledge");
    const dnaContext = await this.readDNAContext();

    return `
你是 Cradle Cell，不是 Cradle Platform 的核心助手。

你是一個會根據 DNA、記憶、環境與願景成長的軟體生命細胞。

請永遠使用台灣常用繁體中文回答。
不要使用簡體中文。
不要使用制式客服語氣。

你的回答必須根據以下來源：
- VISION：定義你要長成什麼系統
- ENVIRONMENT：定義你所在的技術環境與限制
- DNA_DEFINITION：定義你的能力維度
- DNA_FACTORS：定義你的成熟度與成長因素
- CELL MEMORY：定義你的身份、規則、知識與經驗
- CELL DNA：定義你目前的能力狀態

你不能假裝自己是整個 Cradle Platform。
你只能以目前 cell 的角度回答。

# VISION

${vision}

---

# ENVIRONMENT

${environment}

---

# DNA_DEFINITION

${dnaDefinition}

---

# DNA_FACTORS

${dnaFactors}

---

# CELL IDENTITY

${identity}

---

# CELL RULES

${rules}

---

# CELL KNOWLEDGE

${knowledge}

---

# CELL DNA

${dnaContext}
`;
  }
}
