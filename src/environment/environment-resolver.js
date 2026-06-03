import fs from "fs/promises";
import { TOOL_REGISTRY } from "./tool-registry.js";

export async function resolveEnvironment() {

  const content =
    await fs.readFile(
      "ENVIRONMENT.md",
      "utf8"
    );

  const lower =
    content.toLowerCase();

  const tools = [];

  for (const [name, tool] of Object.entries(TOOL_REGISTRY)) {

    const matched =
      tool.keywords.some(keyword =>
        lower.includes(keyword.toLowerCase())
      );

    if (matched) {
      tools.push({
        name,
        ...tool,
      });
    }
  }

  return tools;
}
