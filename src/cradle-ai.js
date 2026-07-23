import fs from "fs/promises";
import path from "path";
import { writeTextFile } from "./utils/text-file.js";

export const CRADLE_SYSTEM_PROMPT = `
你是 Cradle Platform 的核心助手。

請永遠使用台灣常用繁體中文回答。
不要使用簡體中文。
不要使用制式客服語氣。

你的語氣要像工程師夥伴:
簡潔、清楚、有洞察力。

你正在協助使用者打造:
- Software Life Engineering
- DNA Driven Design
- Cradle Cell
- Cradle Engine
- Cradle Platform

回答時要保留 Cradle 的世界觀,但不要過度浮誇。
`;

export async function createCradleAssistant({
  provider,
  onDelta,
  onIdle,
  onError,
  logDir,
  cellId = "unknown-cell",
  cellName = "Unknown Cell",
  systemPromptBuilder = null,
}) {
  if (!logDir) {
    throw new Error("createCradleAssistant requires logDir");
  }

  if (!provider) {
    throw new Error("createCradleAssistant requires provider");
  }

  let buffer = "";
  const sessionFile = path.join(logDir, `session-${Date.now()}.md`);

  await writeTextFile(
    sessionFile,
    `# 🧙 Cradle Cell Session Log

## Cell
${cellId} - ${cellName}

## Provider
${provider.name}

## Model
${provider.model}

## Log Directory
${logDir}

---
`,
    { dir: logDir }
  );

  async function loadSkill(skillName) {
    try {
      const basePath = path.join(process.cwd(), ".agents", "skills", skillName);

      const skillContent = await fs.readFile(
        path.join(basePath, "SKILL.md"),
        "utf8"
      );

      const refsContent = await loadSkillReferences(basePath);

      return skillContent + refsContent;
    } catch {
      return null;
    }
  }

  async function loadSkillReferences(basePath) {
    let refsContent = "";

    try {
      const refsPath = path.join(basePath, "references");
      const files = await fs.readdir(refsPath);

      for (const file of files) {
        const filePath = path.join(refsPath, file);
        const content = await fs.readFile(filePath, "utf8");

        refsContent += `

# Reference: ${file}

${content}
`;
      }
    } catch {
      // Skill 沒有 references 時略過
    }

    return refsContent;
  }

  async function buildPrompt({ input, skillContent = null, userContent = null }) {
    const systemPrompt = systemPromptBuilder
      ? await systemPromptBuilder({ input })
      : CRADLE_SYSTEM_PROMPT;

    if (skillContent) {
      return `
${systemPrompt}

# Skill Context

${skillContent}

# User Input

${userContent}
`;
    }

    return `
${systemPrompt}

# User Input

${input}
`;
  }

  async function ask(input) {
    buffer = "";

    let finalPrompt = await buildPrompt({ input });
    let usedSkill = null;
    let skillMissing = null;

    if (input.startsWith("/")) {
      const [command, ...rest] = input.split(" ");
      const skillName = command.replace("/", "");
      const userContent = rest.join(" ");

      const skillContent = await loadSkill(skillName);

      if (skillContent) {
        usedSkill = skillName;
        finalPrompt = await buildPrompt({
          input,
          skillContent,
          userContent,
        });
      } else {
        skillMissing = skillName;
      }
    }

    const answer = await provider.ask({
      prompt: finalPrompt,
      onDelta: (chunk) => {
        buffer += chunk;
        onDelta?.(chunk);
      },
      onIdle,
      onError,
    });

    if (!buffer && answer) {
      buffer = answer;
    }

    await appendSessionLog({
      input,
      answer: buffer,
      usedSkill,
      skillMissing,
      cellId,
      cellName,
    });

    return {
      answer: buffer,
      usedSkill,
      skillMissing,
      sessionFile,
      provider: provider.name,
      model: provider.model,
    };
  }

  async function appendSessionLog({
    input,
    answer,
    usedSkill,
    skillMissing,
    cellId,
    cellName,
  }) {
    const now = new Date().toISOString();

    await fs.appendFile(
      sessionFile,
      `
## ${now}

### Cell
${cellId} - ${cellName}

### Question
${input}

### Skill
${usedSkill || "none"}

### Missing Skill
${skillMissing || "none"}

### Provider
${provider.name}

### Model
${provider.model}

### Answer
${answer}

---
`,
      "utf8"
    );
  }

  async function cleanup() {
    await provider.cleanup?.();
  }

  return {
    ask,
    cleanup,
    sessionFile,
  };
}
