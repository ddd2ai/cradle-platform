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

    console.log(`🟢 Cell activated: ${this.cell.id}`);
    this.requestActivation("activated");
  }

  async deactivate() {
    if (!this.cell.active) {
      console.log(`Cell already inactive: ${this.cell.id}`);
      return;
    }

    this.cell.active = false;

    if (this.cell.tickTimer) {
      clearTimeout(this.cell.tickTimer);
      this.cell.tickTimer = null;
    }

    this.cell.activationScheduler?.cancel(this.cell.id);
    this.cell.activationQueued = false;
    this.cell.activationRequested = false;

    await this.cell.updateStatus("idle");

    console.log(`⚪ Cell deactivated: ${this.cell.id}`);
  }

  isActive() {
    return this.cell.active;
  }

  requestActivation(_reason = "stimulus") {
    if (!this.cell.active) return false;

    this.cell.runtimeMetrics?.increment("activation_requested", 1, {
      cellId: this.cell.id,
      reason: _reason,
    });
    this.cell.activationRequested = true;
    if (this.cell.isTicking || this.cell.activationQueued || this.cell.tickTimer) {
      this.cell.runtimeMetrics?.increment("activation_coalesced", 1, { cellId: this.cell.id });
      return true;
    }

    if (this.cell.activationScheduler) {
      this.cell.activationQueued = true;
      this.cell.activationScheduler.enqueue(this.cell.id, async () => {
        this.cell.activationQueued = false;
        await this.runScheduledTick();
      });
      return true;
    }

    this.cell.tickTimer = setTimeout(() => {
      this.cell.tickTimer = null;
      this.runScheduledTick().catch(() => {});
    }, 0);
    this.cell.tickTimer.unref?.();
    return true;
  }

  async runScheduledTick() {
    if (!this.cell.active || this.cell.isTicking) return;
    this.cell.activationRequested = false;

    try {
      this.cell.runtimeMetrics?.increment("activation_started", 1, { cellId: this.cell.id });
      const result = await this.tick();
      this.cell.runtimeMetrics?.increment(
        (result?.processed ?? 0) > 0 ? "activation_productive" : "activation_empty",
        1,
        { cellId: this.cell.id, type: result?.type ?? "idle" }
      );
      if (result?.workRemains || this.cell.activationRequested) {
        this.requestActivation("work-remains");
      }
    } catch (error) {
      this.cell.runtimeMetrics?.increment("activation_failed", 1, { cellId: this.cell.id });
      console.log(`[${this.cell.id}] activation failed: ${error.message}`);
      await this.cell.updateStatus("error");
      if (this.cell.active && !this.cell.tickTimer) {
        this.cell.activationRequested = true;
        this.cell.tickTimer = setTimeout(() => {
          this.cell.tickTimer = null;
          this.requestActivation("retry");
        }, this.cell.tickIntervalMs);
        this.cell.tickTimer.unref?.();
      }
    }
  }

  getActiveTick() {
    return this.cell.isTicking
      ? {
          cellId: this.cell.id,
          promise: this.cell.currentTickPromise ?? Promise.resolve(),
        }
      : null;
  }

  async waitForActiveTick() {
    const activeTick = this.getActiveTick();

    if (activeTick) {
      await activeTick.promise;
    }
  }

  async tick() {
    if (this.cell.isTicking) {
      return {
        skipped: true,
        reason: "already ticking",
      };
    }

    this.cell.isTicking = true;
    this.cell.currentTickPromise = this.performTick();

    try {
      return await this.cell.currentTickPromise;
    } catch (error) {
      await this.cell.updateStatus("error");
      throw error;
    } finally {
      this.cell.isTicking = false;
      this.cell.currentTickPromise = null;
      await this.cell.applyPendingAiBinding?.();
    }
  }

  async performTick() {
    const inboxClaim = this.cell.claimInbox
      ? await this.cell.claimInbox()
      : { claimId: null, messages: await this.cell.readInbox() };
    const inbox = inboxClaim.messages;

    if (inbox.length > 0) {
      await this.cell.updateStatus("running");

      let result;
      try {
        result = await this.cell.processInbox(inbox);
        if (this.cell.acknowledgeInboxClaim) {
          await this.cell.acknowledgeInboxClaim(inboxClaim.claimId);
        } else {
          await this.cell.clearInbox();
        }
      } catch (error) {
        await this.cell.releaseInboxClaim?.(inboxClaim.claimId);
        throw error;
      }

      await this.cell.updateStatus(this.cell.active ? "active" : "idle");

      return {
        type: "inbox",
        processed: result.processed ?? inbox.length,
      };
    }

    const task = await this.cell.nextPendingTask();

    if (task) {
      await this.cell.updateStatus("running");

      const result = await this.cell.processTask(task);

      await this.cell.completeTask(task.id);

      const workRemains = Boolean(await this.cell.nextPendingTask());

      await this.cell.updateStatus(this.cell.active ? "active" : "idle");

      return {
        type: "task",
        processed: 1,
        taskId: task.id,
        result,
        workRemains,
      };
    }

    const metabolism = await this.cell.metabolize();

    if ((metabolism.consumed ?? metabolism.created) > 0) {
      return {
        type: "metabolism",
        processed: metabolism.consumed ?? metabolism.created,
        observationFile: metabolism.observationFile,
        workRemains: metabolism.processing === "reasoning",
      };
    }

    const evolution = await this.cell.evolve();

    if (evolution.evolved) {
      return {
        type: "evolution",
        processed: evolution.thoughtCount,
        file: evolution.file,
      };
    }

    return {
      processed: 0,
      reason: "no inbox, task, or stimuli",
    };
  }

  async shutdown() {
    if (this.cell.tickTimer) {
      clearTimeout(this.cell.tickTimer);
      this.cell.tickTimer = null;
    }

    this.cell.active = false;
    this.cell.activationRequested = false;
    this.cell.activationScheduler?.cancel(this.cell.id);
    this.cell.activationQueued = false;
    await this.cell.updateStatus("stopped");
    const assistant = this.cell.assistant ?? await this.cell.assistantPromise?.catch(() => null);
    await assistant?.cleanup?.();
  }
}
