import { evaluateDocumentStimulus } from "../situation/document-stimulus-policy.js";
import { selectStimulusTargets } from "../situation/stimulus-relevance-policy.js";
import {
  decideCultivationQuality,
  observation,
} from "../situation/cultivation-quality-policy.js";
import { StimulusArtifactEvolutionService } from "../production/stimulus-artifact-evolution-service.js";
import { resolveArtifactProductionRequest } from "../production/artifact-production-request.js";
import { CellCultivationCoordinator } from "./cell-cultivation-coordinator.js";
import { abortReason, throwIfAborted } from "../utils/abort.js";

const PHASES = Object.freeze({
  analyzing: 15,
  selecting: 30,
  stimulating: 42,
  cultivating: 58,
  planning: 68,
  producing: 76,
  evolving: 76,
  validating: 90,
  stabilizing: 96,
  stable: 100,
  needs_attention: 100,
});

export class StimulusCultivationService {
  constructor({
    engine,
    eventStream = null,
    artifactEvolutionService,
    coordinator,
    activityLogger = null,
  } = {}) {
    if (!engine) throw new Error("StimulusCultivationService requires engine");
    this.engine = engine;
    this.eventStream = eventStream;
    this.artifactEvolutionService = artifactEvolutionService ?? new StimulusArtifactEvolutionService();
    this.coordinator = coordinator ?? new CellCultivationCoordinator();
    this.activityLogger = activityLogger;
  }

  async cultivate({
    source,
    extraction,
    explicitCellId = null,
    artifactType = null,
    operationId,
    update = () => {},
    signal = null,
  } = {}) {
    throwIfAborted(signal);
    this.activityLogger?.info("cultivation", "routing.started", {
      operationId,
      sourceId: source.sourceId,
      targetCell: explicitCellId ?? "auto",
    });
    updatePhase(update, "analyzing");
    const descriptors = await Promise.all(
      this.engine.listCells().map((cell) => this.#describeCell(cell))
    );
    throwIfAborted(signal);
    updatePhase(update, "selecting");
    const stimulusDraft = {
      summary: `${source.originalName} entered Cradle`,
      content: extraction.text,
      facts: { sourceName: source.originalName },
    };
    const productionIntent = resolveArtifactProductionRequest({
      artifactType,
      text: extraction.text,
      sourceName: source.originalName,
    });
    const routing = selectStimulusTargets({
      stimulus: stimulusDraft,
      cells: descriptors,
      explicitCellId,
    });
    if (routing.needsAttention) {
      this.activityLogger?.warn("cultivation", "routing.needs_attention", {
        operationId,
        sourceId: source.sourceId,
        reason: routing.reason,
      });
      return {
        lifeState: "needs_attention",
        currentStage: "needs_attention",
        routing,
        qualityDecision: {
          outcome: "insufficient_evidence",
          lifeState: "needs_attention",
          reason: routing.reason,
        },
      };
    }

    const cellIds = routing.targets.map((target) => target.cellId);
    this.activityLogger?.info("cultivation", "routing.completed", {
      operationId,
      sourceId: source.sourceId,
      cellIds,
    });
    update({
      context: {
        sourceId: source.sourceId,
        stimulusId: source.stimulusId,
        sourceName: source.originalName,
        artifactType: productionIntent.type ?? null,
        productionMode: productionIntent.mode ?? null,
        cellIds,
      },
    });
    updatePhase(update, "stimulating");
    const targetProgress = new Map(cellIds.map((cellId) => [cellId, {
      progress: PHASES.stimulating,
      currentStage: "stimulating",
    }]));
    const updateTargetProgress = (cellId, patch) => {
      const current = targetProgress.get(cellId);
      targetProgress.set(cellId, {
        progress: Math.max(current.progress, Number(patch.progress) || current.progress),
        currentStage: patch.currentStage ?? current.currentStage,
      });
      const states = [...targetProgress.values()];
      const slowest = states.reduce((lowest, state) =>
        state.progress < lowest.progress ? state : lowest
      );
      update({
        progress: Math.round(states.reduce((sum, state) => sum + state.progress, 0) / states.length),
        currentStage: slowest.currentStage,
        lifeState: "growing",
      });
    };
    const results = await Promise.all(routing.targets.map((target, index) => {
      const cell = this.engine.requireCell(target.cellId);
      return this.coordinator.run(cell.id, () => this.#cultivateCell({
        cell,
        source,
        extraction,
        target,
        productionIntent: {
          ...productionIntent,
          role: index === 0 ? "primary" : "secondary",
        },
        operationId,
        signal,
        update: (patch) => updateTargetProgress(cell.id, patch),
      }), { signal });
    }));
    const needsAttention = results.some((result) => result.lifeState === "needs_attention");
    updatePhase(update, needsAttention ? "needs_attention" : "stable");
    return {
      lifeState: needsAttention ? "needs_attention" : "stable",
      currentStage: needsAttention ? "needs_attention" : "stable",
      routing,
      productionIntent,
      cells: results,
    };
  }

  async #cultivateCell(input) {
    try {
      return await this.#cultivateCellWork(input);
    } catch (error) {
      if (!input.signal?.aborted) throw error;
      await this.#cancelCell(input);
      throw abortReason(input.signal);
    }
  }

  async #cultivateCellWork({
    cell,
    source,
    extraction,
    target,
    productionIntent,
    operationId,
    update,
    signal,
  }) {
    throwIfAborted(signal);
    const policy = applyProductionRequest(
      evaluateDocumentStimulus({ source, extraction, relevance: target.relevance }),
      productionIntent,
    );
    const directProduction = productionIntent?.role === "primary" &&
      productionIntent?.decision === "create";
    this.activityLogger?.info("cultivation", "cell.selected", {
      operationId,
      sourceId: source.sourceId,
      cellId: cell.id,
      relevance: Number(target.relevance.toFixed(3)),
      decision: policy.decision,
      salience: Number(policy.score.toFixed(3)),
      evolveArtifact: policy.evolveArtifact,
    });
    const baseEvidence = [
      observation({
        indicator: "source_integrity",
        outcome: source.sha256 && source.byteLength > 0 ? "sufficient" : "insufficient",
        method: "sha256-and-byte-count",
        expected: "stored source has a cryptographic digest and non-zero bytes",
        actual: `${source.byteLength} bytes sha256=${source.sha256}`,
        evidenceRef: `source:${source.sourceId}`,
      }),
      observation({
        indicator: "content_evidence",
        outcome: extraction.evidence?.outcome ?? "insufficient_evidence",
        method: extraction.method,
        expected: "source content is machine-observable",
        actual: extraction.evidence?.reason ?? extraction.status,
        evidenceRef: `source:${source.sourceId}:extraction`,
      }),
      observation({
        indicator: "cell_relevance",
        outcome: target.relevance > 0 || target.reason === "only available Cell" ? "sufficient" : "insufficient_evidence",
        method: "deterministic-context-term-overlap-v1",
        expected: "target Cell has reproducible relevance evidence",
        actual: `${target.relevance}: ${target.reason}`,
        evidenceRef: `cell:${cell.id}`,
      }),
    ];

    const stimulus = await cell.writeStimulus({
      category: policy.salience.risk >= 0.8 ? "threats" : "signals",
      type: "document.ingested",
      source: "file.ingestion",
      targetCellIds: [cell.id],
      correlationId: operationId,
      causationId: source.stimulusId,
      dedupKey: `file:${source.sha256}:${cell.id}:${productionIntent?.type ?? "observe"}`,
      salience: policy.salience,
      summary: stimulusSummary(source, extraction),
      content: extraction.text,
      facts: {
        sourceId: source.sourceId,
        sourceStimulusId: source.stimulusId,
        sourceName: source.originalName,
        mediaType: source.mediaType,
        byteLength: source.byteLength,
        sha256: source.sha256,
        extractionStatus: extraction.status,
        extractionOutcome: extraction.evidence?.outcome,
        processing: directProduction && policy.decision !== "needs-attention"
          ? "direct-production"
          : policy.decision,
        productionIntent: productionIntent?.decision ?? "observe",
        artifactType: productionIntent?.type ?? null,
        relevance: target.relevance,
      },
      notify: false,
    });
    throwIfAborted(signal);
    let retryingDuplicate = false;
    if (stimulus.duplicate) {
      const currentCultivation = await cell.getCultivationState?.();
      const retryingTerminalStimulus = ["needs_attention", "cancelled"].includes(
        currentCultivation?.state
      ) &&
        currentCultivation.stimulusId === stimulus.duplicateOf;
      if (retryingTerminalStimulus) {
        retryingDuplicate = true;
        this.activityLogger?.info("cultivation", "stimulus.retrying", {
          operationId,
          sourceId: source.sourceId,
          cellId: cell.id,
          stimulusId: stimulus.duplicateOf,
        });
      } else {
        this.activityLogger?.info("cultivation", "stimulus.duplicate", {
          operationId,
          sourceId: source.sourceId,
          cellId: cell.id,
          stimulusId: stimulus.duplicateOf,
        });
        await cell.lifecycleEventStore.appendLifecycleEvent({
          type: "stimulus-cultivation",
          status: "duplicate",
          stimulusId: stimulus.duplicateOf ?? stimulus.envelope.stimulusId,
          sourceId: source.sourceId,
          sourceStimulusId: source.stimulusId,
          salienceDecision: "deduplicated",
        });
        return {
          cellId: cell.id,
          stimulusId: stimulus.duplicateOf ?? stimulus.envelope.stimulusId,
          lifeState: "stable",
          policy: { ...policy, decision: "deduplicated" },
          artifactEvolution: { decision: "not-required", reason: "duplicate Stimulus" },
          qualityDecision: { outcome: "sufficient", lifeState: "stable", duplicate: true },
        };
      }
    }
    if (!retryingDuplicate) {
      this.activityLogger?.info("cultivation", "stimulus.persisted", {
        operationId,
        sourceId: source.sourceId,
        cellId: cell.id,
        stimulusId: stimulus.envelope.stimulusId,
      });
    }
    await this.#publishCellState(cell, {
      state: "stimulated",
      progress: PHASES.stimulating,
      phase: "stimulating",
      operationId,
      stimulusId: stimulus.envelope.stimulusId,
      attention: null,
      evidence: baseEvidence,
    });
    await this.#publishCellState(cell, {
      state: "growing",
      progress: PHASES.cultivating,
      phase: directProduction
        ? "planning"
        : policy.decision === "summary-only" ? "remembering" : "cultivating",
      operationId,
      stimulusId: stimulus.envelope.stimulusId,
    });
    updatePhase(update, directProduction ? "planning" : "cultivating");

    if (policy.decision === "needs-attention") {
      const qualityDecision = decideCultivationQuality(baseEvidence);
      return await this.#finishCell({ cell, source, stimulus, policy, qualityDecision, artifactEvolution: null });
    }

    let memoryRecorded = false;
    let artifactEvolution = { decision: "not-required", reason: policy.reason };
    let artifactHandled = false;
    try {
      const beforeTasks = directProduction ? [] : await cell.readTasks();
      const beforeTaskIds = new Set(beforeTasks.map((task) => task.id));
      await cell.appendKnowledge(buildKnowledgeRecord({ source, stimulus: stimulus.envelope, extraction }));
      throwIfAborted(signal);
      memoryRecorded = true;
      this.activityLogger?.info("cultivation", "memory.recorded", {
        operationId,
        sourceId: source.sourceId,
        cellId: cell.id,
        stimulusId: stimulus.envelope.stimulusId,
      });
      if (directProduction) {
        await cell.archiveStimuli([stimulus]);
        throwIfAborted(signal);
        this.activityLogger?.info("cultivation", "stimulus.absorbed", {
          operationId,
          cellId: cell.id,
          processing: "direct-production",
          consumed: 1,
        });
        const existing = await findOwnedArtifactOfType(cell, productionIntent.type);
        if (existing) {
          // Once a Cell has a product of this type, new Stimuli evolve that
          // product into a new revision instead of creating a parallel copy.
          updatePhase(update, "evolving");
          await this.#publishCellState(cell, { progress: PHASES.evolving, phase: "evolving" });
          this.activityLogger?.info("cultivation", "artifact.evolution_started", {
            operationId,
            sourceId: source.sourceId,
            cellId: cell.id,
            artifactId: existing.artifactId,
            type: productionIntent.type,
          });
          artifactEvolution = await this.artifactEvolutionService.evaluateAndEvolve({
            cell,
            stimulus: stimulus.envelope,
            source,
            signal,
          });
          artifactHandled = true;
          this.activityLogger?.info("cultivation", "artifact.evolution_completed", {
            operationId,
            sourceId: source.sourceId,
            cellId: cell.id,
            artifactId: artifactEvolution.artifactId ?? existing.artifactId,
            revisionId: artifactEvolution.revisionId ?? null,
            decision: artifactEvolution.decision,
          });
        } else {
          updatePhase(update, "producing");
          await this.#publishCellState(cell, {
            progress: PHASES.producing,
            phase: "producing",
          });
          this.activityLogger?.info("cultivation", "artifact.production_started", {
            operationId,
            sourceId: source.sourceId,
            cellId: cell.id,
            type: productionIntent.type,
          });
          const provenance = {
            mode: "stimulus",
            stimulusId: stimulus.envelope.stimulusId,
            sourceId: source.sourceId,
            sourceStimulusId: source.stimulusId,
            sourceName: source.originalName,
            sourceMediaType: source.mediaType,
            sourceSha256: source.sha256,
            cellId: cell.id,
            observedAt: stimulus.envelope.createdAt,
          };
          const produced = await cell.produceArtifact({
            type: productionIntent.type,
            title: productionIntent.title,
            goal: productionIntent.goal,
            origin: {
              ...provenance,
              producerCellId: cell.id,
              targetCellId: cell.id,
            },
            signal,
          });
          artifactEvolution = {
            decision: "created",
            artifactId: produced.artifact.id,
            revisionId: produced.saved.revisionId ?? null,
            changedPaths: produced.artifact.outputs.map((output) => output.path),
            provenance,
          };
          this.activityLogger?.info("cultivation", "artifact.production_completed", {
            operationId,
            sourceId: source.sourceId,
            cellId: cell.id,
            type: productionIntent.type,
            artifactId: produced.artifact.id,
            revisionId: produced.saved.revisionId,
          });
        }
      } else {
        this.activityLogger?.info("cultivation", "metabolism.started", {
          operationId,
          cellId: cell.id,
          mode: policy.decision,
        });
        const metabolism = await cell.metabolismService.metabolize({
          summaryOnly: policy.decision === "summary-only",
          signal,
        });
        this.activityLogger?.info("cultivation", "metabolism.completed", {
          operationId,
          cellId: cell.id,
          processing: metabolism.processing ?? policy.decision,
          consumed: metabolism.consumed ?? 0,
          tasksCreated: metabolism.created ?? 0,
        });
      }
      if (!directProduction && policy.decision === "cultivate") {
        const newTasks = (await cell.readTasks()).filter(
          (task) => task.status === "pending" && !beforeTaskIds.has(task.id)
        ).slice(0, 1);
        if (newTasks.length > 0) {
          updatePhase(update, "planning");
          await this.#publishCellState(cell, {
            progress: PHASES.planning,
            phase: "planning",
          });
          this.activityLogger?.info("cultivation", "task.queued", {
            operationId,
            sourceId: source.sourceId,
            cellId: cell.id,
            taskId: newTasks[0].id,
          });
        }
      }
    } catch (error) {
      if (signal?.aborted) throw abortReason(signal);
      this.activityLogger?.error("cultivation", "cell.failed", {
        operationId,
        sourceId: source.sourceId,
        cellId: cell.id,
        stage: directProduction && memoryRecorded ? "production" : memoryRecorded ? "metabolism" : "memory",
        error: error.message,
      });
      const qualityDecision = decideCultivationQuality([
        ...baseEvidence,
        gateFailure(
          directProduction && memoryRecorded ? "artifact_integrity" : "memory_recorded",
          error.message,
          source.sourceId,
        ),
      ]);
      return await this.#finishCell({
        cell,
        source,
        stimulus,
        policy,
        qualityDecision,
        artifactEvolution: directProduction
          ? { decision: "needs-attention", reason: error.message }
          : null,
      });
    }

    if (policy.evolveArtifact && !artifactHandled) {
      updatePhase(update, "evolving");
      await this.#publishCellState(cell, { progress: PHASES.evolving, phase: "evolving" });
      this.activityLogger?.info("cultivation", "artifact.evaluation_started", {
        operationId,
        sourceId: source.sourceId,
        cellId: cell.id,
      });
      try {
        const evaluation = await this.artifactEvolutionService.evaluateAndEvolve({
          cell,
          stimulus: stimulus.envelope,
          source,
          signal,
        });
        // Evaluation may report "none" because no further revision is needed;
        // retain the Artifact creation decision so the Stimulus still has a
        // durable product in its cultivation result and provenance.
        artifactEvolution = evaluation?.decision === "none" && artifactEvolution.decision === "created"
          ? { ...artifactEvolution, evaluationDecision: "none" }
          : evaluation;
        this.activityLogger?.info("cultivation", "artifact.evaluation_completed", {
          operationId,
          sourceId: source.sourceId,
          cellId: cell.id,
          decision: artifactEvolution.decision,
          artifactId: artifactEvolution.artifactId,
          revisionId: artifactEvolution.revisionId,
        });
      } catch (error) {
        if (signal?.aborted) throw abortReason(signal);
        artifactEvolution = { decision: "needs-attention", reason: error.message };
        this.activityLogger?.warn("cultivation", "artifact.needs_attention", {
          operationId,
          sourceId: source.sourceId,
          cellId: cell.id,
          reason: error.message,
        });
      }
    }
    updatePhase(update, "validating");
    await this.#publishCellState(cell, { progress: PHASES.validating, phase: "validating" });

    const artifactOutcome = artifactEvolution.decision === "needs-attention"
      ? "insufficient_evidence"
      : "sufficient";
    const provenanceOutcome = ["created", "evolved"].includes(artifactEvolution.decision) && !artifactEvolution.provenance
      ? "insufficient"
      : "sufficient";
    const qualityDecision = decideCultivationQuality([
      ...baseEvidence,
      observation({
        indicator: "memory_recorded",
        outcome: memoryRecorded ? "sufficient" : "insufficient",
        method: "cell-memory-append",
        expected: "Stimulus provenance is written to Cell knowledge",
        actual: memoryRecorded ? "recorded" : "not recorded",
        evidenceRef: `cell:${cell.id}:memory`,
      }),
      observation({
        indicator: "artifact_integrity",
        outcome: artifactOutcome,
        method: "artifact-impact-and-validation",
        expected: "Artifact is unchanged or a validated owner revision is stored",
        actual: artifactEvolution.reason
          ? `${artifactEvolution.decision}: ${artifactEvolution.reason}`
          : artifactEvolution.decision,
        evidenceRef: artifactEvolution.artifactId
          ? `artifact:${artifactEvolution.artifactId}:${artifactEvolution.revisionId ?? "current"}`
          : `cell:${cell.id}:artifacts`,
      }),
      observation({
        indicator: "provenance_recorded",
        outcome: provenanceOutcome,
        method: "stimulus-artifact-lineage",
        expected: "Every Artifact mutation identifies its Stimulus and source",
        actual: artifactEvolution.provenance ?? "no Artifact mutation",
        evidenceRef: `stimulus:${stimulus.envelope.stimulusId}`,
      }),
    ]);
    updatePhase(update, "stabilizing");
    await this.#publishCellState(cell, { progress: PHASES.stabilizing, phase: "stabilizing" });
    return await this.#finishCell({ cell, source, stimulus, policy, qualityDecision, artifactEvolution });
  }

  async #cancelCell({ cell, source, operationId }) {
    const current = await cell.getCultivationState?.();
    if (current?.operationId !== operationId) return;
    const cultivation = await this.#publishCellState(cell, {
      state: "cancelled",
      phase: "cancelled",
      attention: null,
    });
    await cell.lifecycleEventStore.appendLifecycleEvent({
      type: "stimulus-cultivation",
      status: "cancelled",
      stimulusId: current.stimulusId ?? null,
      sourceId: source.sourceId,
      sourceStimulusId: source.stimulusId,
      qualityOutcome: null,
      salienceDecision: "cancelled-by-user",
    });
    this.activityLogger?.info("cultivation", "cell.cancelled", {
      operationId,
      sourceId: source.sourceId,
      cellId: cell.id,
      stimulusId: cultivation.stimulusId,
    });
  }

  async #finishCell({ cell, source, stimulus, policy, qualityDecision, artifactEvolution }) {
    const stable = qualityDecision.lifeState === "stable";
    const attentionGate = qualityDecision.gates?.find((gate) => gate.outcome !== "sufficient");
    const cultivation = await this.#publishCellState(cell, {
      state: qualityDecision.lifeState,
      progress: 100,
      phase: qualityDecision.lifeState,
      attention: stable ? null : {
        code: "CULTIVATION_EVIDENCE_REQUIRED",
        message: attentionGate?.actual ?? "Cultivation requires human attention",
      },
      evidence: qualityDecision.gates ?? [],
    });
    await cell.lifecycleEventStore.appendLifecycleEvent({
      type: "stimulus-cultivation",
      status: qualityDecision.lifeState,
      stimulusId: stimulus.envelope.stimulusId,
      sourceId: source.sourceId,
      sourceStimulusId: source.stimulusId,
      artifactId: artifactEvolution?.artifactId ?? null,
      artifactRevisionId: artifactEvolution?.revisionId ?? null,
      qualityContract: qualityDecision.contract,
      qualityOutcome: qualityDecision.outcome,
      salienceDecision: policy.decision,
    });
    this.activityLogger?.[stable ? "info" : "warn"](
      "cultivation",
      stable ? "cell.stable" : "cell.needs_attention",
      {
        operationId: cultivation.operationId,
        sourceId: source.sourceId,
        cellId: cell.id,
        stimulusId: stimulus.envelope.stimulusId,
        quality: qualityDecision.outcome,
        artifactDecision: artifactEvolution?.decision,
        reason: stable ? undefined : attentionGate?.actual,
      },
    );
    return {
      cellId: cell.id,
      stimulusId: stimulus.envelope.stimulusId,
      lifeState: cultivation.state,
      policy,
      artifactEvolution,
      qualityDecision,
    };
  }

  async #describeCell(cell) {
    const [profile, livingContext, catalog] = await Promise.all([
      cell.getProfile(),
      cell.readLivingContext(),
      cell.artifactStore.listArtifactSummaries(),
    ]);
    return {
      cellId: cell.id,
      name: cell.name,
      purpose: livingContext?.purpose,
      responsibilities: livingContext?.responsibilities ?? profile.responsibilities ?? [],
      owns: livingContext?.owns ?? [],
      excludes: livingContext?.excludes ?? [],
      inputs: livingContext?.inputs ?? [],
      outputs: livingContext?.outputs ?? [],
      artifacts: catalog.artifacts ?? [],
    };
  }

  async #publishCellState(cell, patch) {
    const cultivation = await cell.updateCultivationState(patch);
    this.eventStream?.publish("cell.cultivation.updated", { cellId: cell.id, cultivation });
    return cultivation;
  }
}

function updatePhase(update, phase) {
  update({ progress: PHASES[phase], currentStage: phase, lifeState: "growing" });
}

function stimulusSummary(source, extraction) {
  const excerpt = String(extraction.text ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  return excerpt || `${source.originalName} (${source.mediaType}, ${source.byteLength} bytes)`;
}

async function findOwnedArtifactOfType(cell, type) {
  const catalog = await cell.artifactStore.listArtifactSummaries();
  return (catalog.artifacts ?? []).find((artifact) =>
    artifact.ownerCellId === cell.id && artifact.type === type
  ) ?? null;
}

function buildKnowledgeRecord({ source, stimulus, extraction }) {
  const content = String(extraction.text ?? "").trim().slice(0, 4_000);
  return `\n## Stimulus ${stimulus.stimulusId}\n\n- sourceStimulusId: ${source.stimulusId}\n- sourceId: ${source.sourceId}\n- source: ${source.originalName}\n- mediaType: ${source.mediaType}\n- observedAt: ${stimulus.createdAt}\n- sha256: ${source.sha256}\n\n${content || "[Content unavailable: insufficient extraction evidence]"}\n`;
}

function gateFailure(indicator, actual, sourceId) {
  return observation({
    indicator,
    outcome: "error",
    method: "cultivation-runtime",
    expected: "gate completes without error",
    actual,
    evidenceRef: `source:${sourceId}`,
  });
}

function applyProductionRequest(policy, request) {
  if (!request || request.decision === "observe") return policy;
  if (policy.decision === "needs-attention") return policy;

  if (request.role === "secondary") {
    return {
      ...policy,
      decision: "summary-only",
      activate: false,
      evolveArtifact: false,
      reason: "Secondary Cell records the Stimulus without duplicating Artifact production",
    };
  }

  return {
    ...policy,
    decision: "cultivate",
    activate: true,
    // Automatic production still goes through the normal artifact evaluation
    // gate so risky or invalid output cannot be reported as stable.
    evolveArtifact: request.mode === "automatic" ? true : false,
    score: Math.max(0.68, policy.score),
    reason: request.reason,
  };
}
