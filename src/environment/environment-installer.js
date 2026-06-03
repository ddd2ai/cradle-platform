import { exec } from "child_process";
import { promisify } from "util";
import { spawn } from "child_process";

const execAsync =
  promisify(exec);

export async function isInstalled(tool) {

  try {

    await execAsync(
      tool.check
    );

    return true;

  } catch {

    return false;
  }
}

export async function installTool(tool) {
  console.log(`Installing ${tool.name}...`);
  console.log(`$ ${tool.install}`);

  return new Promise((resolve, reject) => {
    const child = spawn(tool.install, {
      shell: true,
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${tool.name} install failed with code ${code}`));
      }
    });

    child.on("error", reject);
  });
}
