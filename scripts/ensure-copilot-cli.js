import net from "node:net";
import { spawn } from "node:child_process";

const PORT = 4321;
const HOST = "127.0.0.1";

function isRunning() {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(500);

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", () => {
      resolve(false);
    });

    socket.connect(PORT, HOST);
  });
}

async function waitUntilRunning(timeoutMs = 10_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isRunning()) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return false;
}

if (await isRunning()) {
  console.log("✅ Copilot CLI server already running on port 4321");
  process.exit(0);
}

console.log("🚀 Starting Copilot CLI server on port 4321");

// 相當於指令 > copilot --headless --port 4321

const child = spawn("copilot", ["--headless", "--port", String(PORT)], {
  detached: true,
  stdio: "inherit",
  shell: true
});

child.unref();

const ready = await waitUntilRunning();

if (!ready) {
  console.error("❌ Copilot CLI server failed to start on port 4321");
  process.exit(1);
}

console.log("✅ Copilot CLI server is ready");