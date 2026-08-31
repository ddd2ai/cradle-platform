import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_ACQUIRE_TIMEOUT_MS = 30_000;
const DEFAULT_STALE_AFTER_MS = 120_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const DEFAULT_MIN_RETRY_MS = 5;
const DEFAULT_MAX_RETRY_MS = 100;

export class ArtifactMutationFileLease {
  constructor({
    acquireTimeoutMs = DEFAULT_ACQUIRE_TIMEOUT_MS,
    staleAfterMs = DEFAULT_STALE_AFTER_MS,
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
    minRetryMs = DEFAULT_MIN_RETRY_MS,
    maxRetryMs = DEFAULT_MAX_RETRY_MS,
    now = () => Date.now(),
    sleep = wait,
    tokenFactory = () => randomUUID(),
  } = {}) {
    this.acquireTimeoutMs = acquireTimeoutMs;
    this.staleAfterMs = staleAfterMs;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.minRetryMs = minRetryMs;
    this.maxRetryMs = maxRetryMs;
    this.now = now;
    this.sleep = sleep;
    this.tokenFactory = tokenFactory;
  }

  async runExclusive(artifactDir, operation) {
    if (!artifactDir || typeof operation !== "function") {
      throw new Error("ArtifactMutationFileLease requires artifactDir and operation");
    }

    const lease = await this.#acquire(artifactDir);
    const heartbeat = setInterval(() => {
      void this.#renew(lease);
    }, this.heartbeatIntervalMs);
    heartbeat.unref?.();
    let result;
    let operationError;
    try {
      result = await operation({
        waitMs: lease.acquiredAt - lease.startedAt,
        contentionCount: lease.contentionCount,
        staleRecovered: lease.staleRecovered,
      });
    } catch (error) {
      operationError = error;
    } finally {
      clearInterval(heartbeat);
    }
    let releaseError;
    try {
      await this.#release(lease);
    } catch (error) {
      releaseError = error;
    }
    if (operationError) throw operationError;
    if (releaseError) throw releaseError;
    return result;
  }

  async #acquire(artifactDir) {
    await fs.mkdir(artifactDir, { recursive: true });
    const lockDir = path.join(artifactDir, ".mutation.lock");
    const startedAt = this.now();
    let contentionCount = 0;
    let staleRecovered = 0;

    while (true) {
      const token = this.tokenFactory();
      try {
        await fs.mkdir(lockDir);
        const acquiredAt = this.now();
        const lease = {
          lockDir,
          ownerFile: path.join(lockDir, "owner.json"),
          token,
          startedAt,
          acquiredAt,
          contentionCount,
          staleRecovered,
        };
        try {
          await fs.writeFile(lease.ownerFile, JSON.stringify({
            schemaVersion: 1,
            token,
            pid: process.pid,
            acquiredAt: new Date(acquiredAt).toISOString(),
          }), { encoding: "utf8", flag: "wx" });
          await touchDirectory(lockDir, acquiredAt);
          return lease;
        } catch (error) {
          await fs.rm(lockDir, { recursive: true, force: true });
          throw error;
        }
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }

      contentionCount += 1;
      if (await this.#recoverStale(lockDir)) {
        staleRecovered += 1;
        continue;
      }
      const elapsedMs = this.now() - startedAt;
      if (elapsedMs >= this.acquireTimeoutMs) {
        throw new Error(
          `Artifact mutation lease timed out after ${elapsedMs}ms: ${artifactDir}`
        );
      }
      const retryMs = Math.min(
        this.maxRetryMs,
        this.minRetryMs * (2 ** Math.min(contentionCount - 1, 8))
      );
      await this.sleep(retryMs);
    }
  }

  async #recoverStale(lockDir) {
    let stat;
    try {
      stat = await fs.stat(lockDir);
    } catch (error) {
      if (error?.code === "ENOENT") return true;
      throw error;
    }
    if (this.now() - stat.mtimeMs < this.staleAfterMs) return false;

    const staleDir = `${lockDir}.stale-${this.tokenFactory()}`;
    try {
      await fs.rename(lockDir, staleDir);
    } catch (error) {
      if (error?.code === "ENOENT") return true;
      throw error;
    }
    await fs.rm(staleDir, { recursive: true, force: true });
    return true;
  }

  async #renew(lease) {
    try {
      if (!await ownsLease(lease)) return;
      await touchDirectory(lease.lockDir, this.now());
    } catch {
      // Renewal failure is handled by token-aware release and stale recovery.
    }
  }

  async #release(lease) {
    try {
      if (!await ownsLease(lease)) return;
      await fs.rm(lease.lockDir, { recursive: true, force: true });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

export const defaultArtifactMutationFileLease =
  new ArtifactMutationFileLease();

async function ownsLease(lease) {
  try {
    const owner = JSON.parse(await fs.readFile(lease.ownerFile, "utf8"));
    return owner.token === lease.token;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function touchDirectory(directory, timestampMs) {
  const timestamp = new Date(timestampMs);
  await fs.utimes(directory, timestamp, timestamp);
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
