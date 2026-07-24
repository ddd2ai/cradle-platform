export class CellArtifactStabilizationService {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellArtifactStabilizationService requires cell");
    }

    this.cell = cell;
  }

  async repairArtifactFromTask({
    artifactId,
    task,
    executionResult,
  } = {}) {
    if (!artifactId) {
      throw new Error("repairArtifactFromTask requires artifactId");
    }

    if (!task) {
      throw new Error("repairArtifactFromTask requires task");
    }

    const result =
      await this.cell.productionService.repairArtifactFromExecution({
        artifactId,
        task,
        executionResult:
          executionResult?.toJSON?.() ??
          executionResult,
      });

    await this.cell.completeTask(task.id);

    return result;
  }

  async stabilizeArtifact({
    artifactId,
    maxRounds = 3,
  } = {}) {
    if (!artifactId) {
      throw new Error("stabilizeArtifact requires artifactId");
    }

    const history = [];

    for (let round = 1; round <= maxRounds; round++) {
      const beforeTasks = await this.cell.readTasks();
      const beforeTaskIds = new Set(beforeTasks.map((task) => task.id));

      const execution = await this.cell.executeArtifact(artifactId);
      const executionResult = execution.result;

      const passed = executionResult.status === "passed";

      const metabolism = await this.cell.metabolize();

      const afterTasks = await this.cell.readTasks();

      const generatedTasks = afterTasks.filter(
        (task) =>
          task.status === "pending" &&
          !beforeTaskIds.has(task.id)
      );

      // Successful rounds may create suggestions, but not repair tasks.
      const repairTasks = passed
        ? []
        : generatedTasks.slice(0, 1);

      if (passed) {
        for (const task of generatedTasks) {
          await this.cell.completeTask(task.id);
        }
      }

      const roundRecord = {
        round,
        executionStatus: executionResult.status,
        createdTasks: repairTasks.length,
        observationFile: metabolism.observationFile,
        newTasks: repairTasks.map((task) => ({
          id: task.id,
          title: task.title,
        })),
      };

      history.push(roundRecord);

      const artifactState =
        await this.cell.stabilityStore.appendArtifactRecord(
          artifactId,
          {
            round,
            executionStatus: executionResult.status,
            createdTasks: repairTasks.length,
            observationFile: metabolism.observationFile,
            tasks: repairTasks.map((task) => ({
              id: task.id,
              title: task.title,
            })),
          }
        );

      if (artifactState.status === "stable") {
        await this.cell.appendHistory(`
## ${new Date().toISOString()}

### Artifact Stabilized

- artifactId: ${artifactId}
- rounds: ${round}
- status: stable
- consecutivePassed: ${artifactState.consecutivePassed}
- consecutiveNoTask: ${artifactState.consecutiveNoTask}
- repairCount: ${artifactState.repairCount}
`);

        return {
          stable: true,
          artifactId,
          rounds: round,
          artifactState,
          history,
        };
      }

      const repairTask = repairTasks[0];

      if (!repairTask) {
        if (passed) {
          continue;
        }

        return {
          stable: false,
          artifactId,
          reason: "execution failed and no repair task was created",
          artifactState,
          history,
        };
      }

      await this.repairArtifactFromTask({
        artifactId,
        task: repairTask,
        executionResult,
      });
    }

    const finalState = await this.cell.stabilityStore.getArtifactState(artifactId);

    return {
      stable: false,
      artifactId,
      reason: "max rounds reached",
      artifactState: finalState,
      history,
    };
  }
}
