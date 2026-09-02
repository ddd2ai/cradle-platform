import { ApiError } from "../api/api-error.js";
import { randomUUID } from "node:crypto";
import { normalizeStimulusEnvelope } from "../situation/stimulus-envelope.js";

export class IngestFileStimulusUseCase {
  constructor({
    engine,
    sourceStore,
    extractorRegistry,
    cultivationService,
    operationRunner,
    activityLogger = null,
  } = {}) {
    if (!engine || !sourceStore || !extractorRegistry || !cultivationService || !operationRunner) {
      throw new Error("IngestFileStimulusUseCase requires all collaborators");
    }
    this.engine = engine;
    this.sourceStore = sourceStore;
    this.extractorRegistry = extractorRegistry;
    this.cultivationService = cultivationService;
    this.operationRunner = operationRunner;
    this.activityLogger = activityLogger;
  }

  async execute({ fileName, mediaType, bytes, cellId = null } = {}) {
    const explicitCellId = String(cellId ?? "").trim() || null;
    if (explicitCellId && !this.engine.getCell(explicitCellId)) {
      throw new ApiError({
        status: 404,
        code: "CELL_NOT_FOUND",
        message: `Cell ${explicitCellId} was not found`,
      });
    }

    let source;
    try {
      source = await this.sourceStore.accept({ fileName, mediaType, bytes });
    } catch (error) {
      throw new ApiError({
        status: error.code === "INVALID_SOURCE_DOCUMENT" ? 400 : 500,
        code: error.code ?? "SOURCE_ACCEPTANCE_FAILED",
        message: error.message,
      });
    }
    this.activityLogger?.info("stimulus", "source.accepted", {
      sourceId: source.sourceId,
      file: source.originalName,
      mediaType: source.mediaType,
      bytes: source.byteLength,
    });

    const acceptedStimulus = normalizeStimulusEnvelope({
      stimulusId: `stim-${randomUUID()}`,
      type: "document.accepted",
      source: "file.ingestion",
      targetCellIds: explicitCellId ? [explicitCellId] : [],
      correlationId: null,
      dedupKey: `source:${source.sha256}`,
      summary: `${source.originalName} accepted by Cradle`,
      facts: {
        sourceId: source.sourceId,
        sourceName: source.originalName,
        mediaType: source.mediaType,
        byteLength: source.byteLength,
        sha256: source.sha256,
        processing: "accepted",
      },
    });
    await this.sourceStore.recordStimulus(source.sourceId, acceptedStimulus);
    source = { ...source, stimulusId: acceptedStimulus.stimulusId };

    const operation = this.operationRunner.start({
      type: "stimulus-cultivation",
      context: {
        sourceId: source.sourceId,
        stimulusId: source.stimulusId,
        sourceName: source.originalName,
        cellIds: explicitCellId ? [explicitCellId] : [],
      },
      task: async ({ update, operationId }) => {
        try {
          update({ progress: 10, currentStage: "analyzing", lifeState: "growing" });
          this.activityLogger?.info("stimulus", "extraction.started", {
            operationId,
            sourceId: source.sourceId,
          });
          const content = await this.sourceStore.readBytes(source.sourceId);
          const targetCell = explicitCellId ? this.engine.getCell(explicitCellId) : null;
          const extraction = await this.extractorRegistry.extract({
            source,
            bytes: content,
            context: {
              provider: targetCell?.provider ?? this.engine.provider,
              model: targetCell?.model ?? this.engine.model,
            },
          });
          await this.sourceStore.recordExtraction(source.sourceId, extraction);
          this.activityLogger?.info("stimulus", "extraction.completed", {
            operationId,
            sourceId: source.sourceId,
            method: extraction.method,
            status: extraction.status,
            evidence: extraction.evidence?.outcome,
            characters: extraction.text?.length ?? 0,
          });
          return await this.cultivationService.cultivate({
            source,
            extraction,
            explicitCellId,
            operationId,
            update,
          });
        } catch (error) {
          this.activityLogger?.error("stimulus", "operation.failed", {
            operationId,
            sourceId: source.sourceId,
            error: error?.message ?? "Unknown cultivation error",
          });
          throw error;
        }
      },
    });
    this.activityLogger?.info("stimulus", "operation.accepted", {
      operationId: operation.operationId,
      sourceId: source.sourceId,
      stimulusId: source.stimulusId,
      targetCell: explicitCellId ?? "auto",
    });

    return {
      operationId: operation.operationId,
      type: operation.type,
      status: operation.status,
      progress: operation.progress,
      currentStage: operation.currentStage,
      lifeState: "growing",
      source: {
        sourceId: source.sourceId,
        originalName: source.originalName,
        mediaType: source.mediaType,
        byteLength: source.byteLength,
        sha256: source.sha256,
        stimulusId: source.stimulusId,
      },
      context: operation.context,
    };
  }
}
