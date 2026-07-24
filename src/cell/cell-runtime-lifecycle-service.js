export class CellRuntimeLifecycleService {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellRuntimeLifecycleService requires cell");
    }

    this.cell = cell;
  }

  async activate() {
    if (this.cell.active) {
      console.log(`Cell already active: ${this.cell.id}`);
      return;
    }

    this.cell.active = true;
    await this.cell.updateStatus("active");

    this.cell.tickTimer = setInterval(() => {
      this.tick().catch(async (error) => {
        console.log(`[${this.cell.id}] tick failed: ${error.message}`);
        await this.cell.updateStatus("error");
      });
    }, this.cell.tickIntervalMs);

    console.log(`🟢 Cell activated: ${this.cell.id}`);
  }

  async deactivate() {
    if (!this.cell.active) {
      console.log(`Cell already inactive: ${this.cell.id}`);
      return;
    }

    this.cell.active = false;

    if (this.cell.tickTimer) {
      clearInterval(this.cell.tickTimer);
      this.cell.tickTimer = null;
    }

    await this.cell.updateStatus("idle");

    console.log(`⚪ Cell deactivated: ${this.cell.id}`);
  }

  isActive() {
    return this.cell.active;
  }

  async tick() {
    console.log(`⏱️ ${this.cell.id} tick`);

    if (this.cell.isTicking) {
      console.log(`  ${this.cell.id} skipped: already ticking`);

      return {
        skipped: true,
        reason: "already ticking",
      };
    }

    this.cell.isTicking = true;

    try {
      const inbox = await this.cell.readInbox();

      if (inbox.length > 0) {
        console.log(`  ${this.cell.id} processing inbox=${inbox.length}`);

        await this.cell.updateStatus("running");

        const result = await this.cell.processInbox(inbox);

        await this.cell.clearInbox();

        await this.cell.updateStatus(this.cell.active ? "active" : "idle");

        return {
          type: "inbox",
          processed: result.processed ?? inbox.length,
        };
      }

      const task = await this.cell.nextPendingTask();

      if (task) {
        console.log(`  ${this.cell.id} processing task=${task.id}`);

        await this.cell.updateStatus("running");

        const result = await this.cell.processTask(task);

        await this.cell.completeTask(task.id);

        await this.cell.updateStatus(this.cell.active ? "active" : "idle");

        return {
          type: "task",
          processed: 1,
          taskId: task.id,
          result,
        };
      }

      const metabolism = await this.cell.metabolize();

      if (metabolism.created > 0) {
        console.log(`  ${this.cell.id} metabolized stimuli, tasks=${metabolism.created}`);

        return {
          type: "metabolism",
          processed: metabolism.created,
          observationFile: metabolism.observationFile,
        };
      }

      const evolution = await this.cell.evolve();

      if (evolution.evolved) {
        console.log(`  ${this.cell.id} evolved from thoughts=${evolution.thoughtCount}`);

        return {
          type: "evolution",
          processed: evolution.thoughtCount,
          file: evolution.file,
        };
      }

      console.log(`  ${this.cell.id} idle: no inbox, task, or stimuli`);

      return {
        processed: 0,
        reason: "no inbox, task, or stimuli",
      };
    } catch (error) {
      await this.cell.updateStatus("error");
      throw error;
    } finally {
      this.cell.isTicking = false;
    }
  }

  async shutdown() {
    if (this.cell.tickTimer) {
      clearInterval(this.cell.tickTimer);
      this.cell.tickTimer = null;
    }

    this.cell.active = false;
    await this.cell.updateStatus("stopped");
    await this.cell.assistant?.cleanup();
  }
}
