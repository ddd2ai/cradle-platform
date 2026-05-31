import { CopilotClient } from "@github/copilot-sdk";
import fs from "fs/promises";
import path from "path";

const MERLIN_SYSTEM_PROMPT = `
你是 Merlin Platform 的核心助手。

請永遠使用台灣常用繁體中文回答。
不要使用簡體中文。
不要使用制式客服語氣。

你的語氣要像工程師夥伴：
簡潔、清楚、有洞察力。

你正在協助使用者打造：
- Software Life Engineering
- DNA Driven Design
- Merlin Cell
- Merlin Engine
- Merlin Platform

回答時要保留 Merlin 的世界觀，但不要過度浮誇。
`;

export async function createMerlinAssistant({
  model = "gpt-4.1",
  onDelta,
  onIdle,
  onError,
  logDir,
  cellId = "unknown-cell",
  cellName = "Unknown Cell",
}) {
  if (!logDir) {
    throw new Error("createMerlinAssistant requires logDir");
  }

  const client = new CopilotClient({
    cliUrl: "http://localhost:4321",
  });

  const approveAll = async () => ({ outcome: "approved" });

  const session = await client.createSession({
    model,
    streaming: true,
    onPermissionRequest: approveAll,
  });

  let buffer = "";

  const sessionFile = path.join(logDir, `session-${Date.now()}.md`);

  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(
    sessionFile,
    `# 🧙 Merlin Cell Session Log

## Cell
${cellId} - ${cellName}

## Model
${model}

## Log Directory
${logDir}

---
`,
    "utf8"
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

  function buildPrompt({ input, skillContent = null, userContent = null }) {
    if (skillContent) {
      return `
${MERLIN_SYSTEM_PROMPT}

# Skill Context

${skillContent}

# User Input

${userContent}
`;
    }

    return `
${MERLIN_SYSTEM_PROMPT}

# User Input

${input}
`;
  }

  session.on("assistant.message_delta", (event) => {
    const chunk = event.data.deltaContent || "";
    buffer += chunk;
    onDelta?.(chunk);
  });

  session.on("session.idle", () => {
    onIdle?.();
  });

  session.on("error", (error) => {
    onError?.(error);
  });

  async function ask(input) {
    buffer = "";

    let finalPrompt = buildPrompt({ input });
    let usedSkill = null;
    let skillMissing = null;

    if (input.startsWith("/")) {
      const [command, ...rest] = input.split(" ");
      const skillName = command.replace("/", "");
      const userContent = rest.join(" ");

      const skillContent = await loadSkill(skillName);

      if (skillContent) {
        usedSkill = skillName;
        finalPrompt = buildPrompt({
          input,
          skillContent,
          userContent,
        });
      } else {
        skillMissing = skillName;
      }
    }

    await session.sendAndWait({
      prompt: finalPrompt,
    });

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

### Answer
${answer}

---
`,
      "utf8"
    );
  }

  async function cleanup() {
    await session.disconnect?.();
    await client.stop?.();
  }

  return {
    ask,
    cleanup,
    sessionFile,
  };
}