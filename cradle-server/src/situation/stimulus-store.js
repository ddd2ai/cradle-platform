import path from "path";
import fs from "fs/promises";
import { createHash, randomUUID } from "crypto";
import { writeJsonFile, readJsonFile } from "../utils/json-file.js";
import { normalizeStimulusEnvelope } from "./stimulus-envelope.js";
import { legacyStimulusToEnvelope } from "./legacy-stimulus-adapter.js";
import { resolveStimulusTargets } from "./stimulus-router.js";

export const STIMULUS_CATEGORIES = Object.freeze([
  "signals",
  "threats",
  "pressures",
  "resources",
]);

export class StimulusStore {
  constructor({
    stimuliDir,
    timestampFormatter,
    consumerId = null,
    metrics = null,
  } = {}) {
    if (!stimuliDir) {
      throw new Error("StimulusStore requires stimuliDir");
    }

    if (!timestampFormatter) {
      throw new Error("StimulusStore requires timestampFormatter");
    }

    this.stimuliDir = stimuliDir;
    this.timestampFormatter = timestampFormatter;
    this.consumerId = consumerId;
    this.metrics = metrics;
    this.queuesDir = path.join(stimuliDir, "queues");
    this.dedupDir = path.join(stimuliDir, "dedup");
  }

  async writeStimulus(input = {}) {
    const envelope = normalizeStimulusEnvelope(input, {
      idFactory: () => `stim-${randomUUID()}`,
    });
    this.metrics?.increment("stimuli_received", 1, { type: envelope.type });

    const dedupHash = hash(envelope.dedupKey);
    const dedupPath = path.join(this.dedupDir, `${dedupHash}.json`);
    await fs.mkdir(this.dedupDir, { recursive: true });
    try {
      await fs.writeFile(dedupPath, JSON.stringify({
        stimulusId: envelope.stimulusId,
        dedupKey: envelope.dedupKey,
        createdAt: envelope.createdAt,
      }), { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      this.metrics?.increment("stimuli_deduplicated", 1, { type: envelope.type });
      const existing = await readJsonFile(dedupPath, null);
      return {
        category: envelope.category,
        duplicate: true,
        duplicateOf: existing?.stimulusId ?? null,
        envelope: existing?.stimulusId
          ? { ...envelope, stimulusId: existing.stimulusId }
          : envelope,
      };
    }

    const targets = resolveStimulusTargets(envelope);
    const routes = [];
    try {
      for (const targetCellId of targets) {
        const dir = path.join(this.queuesDir, targetCellId);
        const file = `${dedupHash}.json`;
        const filePath = path.join(dir, file);
        await writeJsonFile(filePath, envelope, { dir });
        routes.push({ targetCellId, file, path: filePath });
      }
    } catch (error) {
      await fs.rm(dedupPath, { force: true });
      throw error;
    }

    this.metrics?.increment("stimuli_routed", routes.length, { type: envelope.type });
    return {
      category: envelope.category,
      file: routes[0]?.file,
      path: routes[0]?.path,
      routes,
      envelope,
    };
  }

  async readStimuli({ consumerId = this.consumerId } = {}) {
    const results = await this.#readIndexedStimuli(consumerId);

    for (const category of STIMULUS_CATEGORIES) {
      const dir = path.join(this.stimuliDir, category);

      try {
        const files = await fs.readdir(dir);

        for (const file of files) {
          if (!file.endsWith(".md")) continue;

          const filePath = path.join(dir, file);
          const content = await fs.readFile(filePath, "utf8");

          const legacy = {
            category,
            file,
            path: filePath,
            content,
          };
          const envelope = legacyStimulusToEnvelope(legacy, {
            idFactory: () => `legacy-${hash(`${category}:${file}`)}`,
          });
          if (
            consumerId &&
            envelope.targetCellIds.length > 0 &&
            !envelope.targetCellIds.includes(consumerId)
          ) continue;
          results.push({ ...legacy, envelope });
        }
      } catch {
        // Missing category directories simply mean no stimuli for that category.
      }
    }

    return results;
  }

  async claimStimuli({ consumerId } = {}) {
    if (!consumerId) {
      throw new Error("claimStimuli requires consumerId");
    }

    const claimId = randomUUID();
    const processingDir = path.join(this.stimuliDir, "processing", claimId);
    const claimed = await this.#claimIndexedStimuli({
      consumerId,
      claimId,
      processingDir,
    });

    for (const category of STIMULUS_CATEGORIES) {
      const dir = path.join(this.stimuliDir, category);
      let files = [];
      try {
        files = await fs.readdir(dir);
      } catch {
        continue;
      }

      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        const from = path.join(dir, file);
        let content;
        try {
          content = await fs.readFile(from, "utf8");
        } catch {
          continue;
        }

        const legacy = { category, file, path: from, content };
        const envelope = legacyStimulusToEnvelope(legacy, {
          idFactory: () => `legacy-${hash(`${category}:${file}`)}`,
        });
        if (
          envelope.targetCellIds.length > 0 &&
          !envelope.targetCellIds.includes(consumerId)
        ) continue;

        await fs.mkdir(processingDir, { recursive: true });
        const claimedFile = `${category}--${file}`;
        const claimedPath = path.join(processingDir, claimedFile);
        try {
          await fs.rename(from, claimedPath);
          claimed.push({
            category,
            file,
            path: claimedPath,
            originalPath: from,
            claimId,
            consumerId,
            targetCellId: envelope.targetCellIds[0] ?? null,
            envelope,
            content,
          });
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      }
    }

    if (claimed.length === 0) {
      await fs.rm(processingDir, { recursive: true, force: true });
    }
    return claimed;
  }

  async archiveStimuli(stimuli = []) {
    const processedDir = path.join(this.stimuliDir, "processed");

    await fs.mkdir(processedDir, { recursive: true });

    for (const item of stimuli) {
      const from = item.path ?? path.join(this.stimuliDir, item.category, item.file);
      const to = path.join(
        processedDir,
        `${item.category}-${this.timestampFormatter(new Date())}-${item.consumerId ?? "legacy"}-${item.file}`
      );

      try {
        await fs.rename(from, to);
      } catch {
        // Ignore stimuli that were already moved or deleted.
      }
    }

    for (const claimId of new Set(stimuli.map((item) => item.claimId).filter(Boolean))) {
      await fs.rm(path.join(this.stimuliDir, "processing", claimId), {
        recursive: true,
        force: true,
      });
    }
  }

  async releaseStimuli(stimuli = []) {
    for (const item of stimuli) {
      if (!item.claimId) continue;
      const to = item.originalPath ?? path.join(this.stimuliDir, item.category, item.file);
      await fs.mkdir(path.dirname(to), { recursive: true });
      try {
        await fs.rename(item.path, to);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }

    for (const claimId of new Set(stimuli.map((item) => item.claimId).filter(Boolean))) {
      await fs.rm(path.join(this.stimuliDir, "processing", claimId), {
        recursive: true,
        force: true,
      });
    }
  }

  async #readIndexedStimuli(consumerId) {
    const targets = consumerId ? [consumerId, "_global"] : ["_global"];
    const results = [];
    for (const target of targets) {
      const dir = path.join(this.queuesDir, target);
      let files = [];
      try {
        files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json"));
      } catch {
        continue;
      }
      for (const file of files) {
        const envelope = await readJsonFile(path.join(dir, file), null);
        if (!envelope) continue;
        results.push(toStimulusItem({
          envelope,
          file,
          path: path.join(dir, file),
          consumerId: target,
        }));
      }
    }
    return results;
  }

  async #claimIndexedStimuli({ consumerId, claimId, processingDir }) {
    const claimed = [];
    for (const target of [consumerId, "_global"]) {
      const dir = path.join(this.queuesDir, target);
      let files = [];
      try {
        files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json"));
      } catch {
        continue;
      }

      for (const file of files) {
        const from = path.join(dir, file);
        await fs.mkdir(processingDir, { recursive: true });
        const claimedPath = path.join(processingDir, `${target}--${file}`);
        try {
          await fs.rename(from, claimedPath);
        } catch (error) {
          if (error?.code === "ENOENT") continue;
          throw error;
        }
        const envelope = await readJsonFile(claimedPath, null);
        if (!envelope) continue;
        const item = toStimulusItem({
          envelope,
          file,
          path: claimedPath,
          originalPath: from,
          consumerId,
          claimId,
        });
        claimed.push(item);
        this.metrics?.observe(
          "stimulus_queue_age_ms",
          Math.max(0, Date.now() - Date.parse(envelope.createdAt)),
          { cellId: consumerId }
        );
      }
    }
    this.metrics?.increment("stimuli_claimed", claimed.length, { cellId: consumerId });
    return claimed;
  }
}

function toStimulusItem({ envelope, file, path: filePath, originalPath, consumerId, claimId }) {
  return {
    category: envelope.category,
    file,
    path: filePath,
    originalPath,
    consumerId,
    claimId,
    targetCellId: envelope.targetCellIds?.[0] ?? null,
    envelope,
    content: envelope.content || JSON.stringify({
      summary: envelope.summary,
      facts: envelope.facts,
    }, null, 2),
  };
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
