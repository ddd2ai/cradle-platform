import fs from "fs/promises";
import path from "path";

export async function writeTextFile(file, content = "", { dir = null } = {}) {
  await fs.mkdir(dir || path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}
