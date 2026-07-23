import fs from "fs/promises";

export async function readJsonFile(file, fallback = null) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(file, data, { dir } = {}) {
  if (dir) {
    await fs.mkdir(dir, { recursive: true });
  }

  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}
