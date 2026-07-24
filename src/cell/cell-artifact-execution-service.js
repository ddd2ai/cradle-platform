import path from "path";

import { block } from "../utils/text.js";
import { ArtifactExecutionService } from "../execution/artifact-execution-service.js";
import { ThreatStore } from "../heartbeat/threat-store.js";
import { buildExecutionStimulus } from "../situation/execution-stimulus.js";

export class CellArtifactExecutionService {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellArtifactExecutionService requires cell");
    }

    this.cell = cell;
  }

  async executeArtifact(artifactId) {
    const executionService = new ArtifactExecutionService({
      cellId: this.cell.id,
      productionsDir: this.cell.productionsDir,
      executionsDir: path.join(this.cell.workspaceDir, "executions"),
      threatStore: new ThreatStore(),
    });

    const result = await executionService.executeArtifact(artifactId);

    const stimulus = buildExecutionStimulus({
      cellId: this.cell.id,
      artifactId,
      executionResult: result.toJSON ? result.toJSON() : result,
    });

    const stimulusFile = await this.cell.writeStimulus({
      category: stimulus.category,
      name: `execution-${artifactId}-${this.cell.formatTimestamp(new Date())}.md`,
      content: stimulus.content,
    });

    await this.cell.appendHistory(
      block([
        `## ${new Date().toISOString()}`,
        "",
        "### Artifact Executed",
        "",
        `- artifactId: ${artifactId}`,
        `- status: ${result.status}`,
        `- executionId: ${result.executionId ?? "-"}`,
        `- stimulus: ${stimulusFile.category}/${stimulusFile.file}`,
        "",
      ])
    );

    return {
      result,
      stimulus: stimulusFile,
    };
  }
}
