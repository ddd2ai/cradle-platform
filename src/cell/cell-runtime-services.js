import { CellTaskStore } from "./cell-task-store.js";
import { CellLifecycleEventStore } from "./cell-lifecycle-event-store.js";
import { CellInboxStore } from "./cell-inbox-store.js";
import { CellMemoryStore } from "./cell-memory-store.js";
import { CellProfileStore } from "./cell-profile-store.js";
import { CellDNAStore } from "./cell-dna-store.js";
import { CellConfigStore } from "./cell-config-store.js";
import { CellEvolutionStore } from "./cell-evolution-store.js";
import { CellWorkspaceStore } from "./cell-workspace-store.js";
import { CellSnapshotStore } from "./cell-snapshot-store.js";
import { LivingContextStore } from "../living-context/living-context-store.js";
import { StimulusStore } from "../situation/stimulus-store.js";
import { ObservationStore } from "../situation/observation-store.js";

export function createCellRuntimeServices({ cell, paths }) {
  const timestampFormatter = (date) => cell.formatTimestamp(date);
  const tail = (content, maxChars) => cell.tail(content, maxChars);

  return {
    taskStore: new CellTaskStore({
      tasksDir: paths.tasksDir,
      tasksFile: paths.tasksFile,
      timestampFormatter,
    }),
    lifecycleEventStore: new CellLifecycleEventStore({
      lifecycleEventsFile: paths.lifecycleEventsFile,
    }),
    inboxStore: new CellInboxStore({
      inboxDir: paths.inboxDir,
      inboxFile: paths.inboxFile,
    }),
    memoryStore: new CellMemoryStore({
      memoryFiles: paths.memoryFiles,
      thoughtsDir: paths.thoughtsDir,
      cellId: cell.id,
      cellName: cell.name,
      timestampFormatter,
    }),
    profileStore: new CellProfileStore({
      cellFile: paths.cellFile,
      profileFile: paths.profileFile,
    }),
    dnaStore: new CellDNAStore({
      dnaVectorFile: paths.dnaVectorFile,
      dnaHistoryFile: paths.dnaHistoryFile,
    }),
    configStore: new CellConfigStore({
      dnaDefinitionFile: paths.dnaDefinitionFile,
      dnaFactorsFile: paths.dnaFactorsFile,
      visionFile: paths.visionFile,
      environmentFile: paths.environmentFile,
      dnaDir: paths.dnaDir,
    }),
    evolutionStore: new CellEvolutionStore({
      thoughtsDir: paths.thoughtsDir,
      evolutionsDir: paths.evolutionsDir,
      evolutionStateFile: paths.evolutionStateFile,
      timestampFormatter,
      tail,
    }),
    workspaceStore: new CellWorkspaceStore({
      workspaceDir: paths.workspaceDir,
    }),
    livingContextStore: new LivingContextStore({
      livingContextFile: paths.livingContextFile,
    }),
    stimulusStore: new StimulusStore({
      stimuliDir: paths.stimuliDir,
      timestampFormatter,
    }),
    observationStore: new ObservationStore({
      observationsDir: paths.observationsDir,
      timestampFormatter,
    }),
    snapshotStore: new CellSnapshotStore({
      cellId: cell.id,
      snapshotsDir: paths.snapshotsDir,
      memoryDir: paths.memoryDir,
      workspaceDir: paths.workspaceDir,
      thoughtsDir: paths.thoughtsDir,
      cellFile: paths.cellFile,
      timestampFormatter,
    }),
  };
}
