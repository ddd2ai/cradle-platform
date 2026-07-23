import path from "path";

export function createCellPaths({
  cellId,
  projectRoot = process.cwd(),
  cellsDir = "cells",
} = {}) {
  if (!cellId) {
    throw new Error("createCellPaths requires cellId");
  }

  const rootDir = path.join(cellsDir, cellId);
  const logsDir = path.join(rootDir, "logs");
  const memoryDir = path.join(rootDir, "memory");
  const dnaDir = path.join(rootDir, "dna");
  const workspaceDir = path.join(rootDir, "workspace");
  const situationDir = path.join(projectRoot, "situation");
  const stimuliDir = path.join(situationDir, "stimuli");
  const observationsDir = path.join(situationDir, "observations");
  const metricsDir = path.join(situationDir, "metrics");
  const productionsDir = path.join(workspaceDir, "productions");
  const reviewsDir = path.join(workspaceDir, "reviews");
  const publicationsDir = path.join(workspaceDir, "publications");

  const workspaceDirs = {
    notes: path.join(workspaceDir, "notes"),
    tasks: path.join(workspaceDir, "tasks"),
    artifacts: path.join(workspaceDir, "artifacts"),
    projects: path.join(workspaceDir, "projects"),
    research: path.join(workspaceDir, "research"),
    decisions: path.join(workspaceDir, "decisions"),
    productions: productionsDir,
    reviews: reviewsDir,
    publications: publicationsDir,
  };

  const inboxDir = path.join(rootDir, "inbox");
  const tasksDir = path.join(rootDir, "tasks");

  return {
    projectRoot,
    cellsDir,
    rootDir,
    logsDir,
    memoryDir,
    dnaDir,
    dnaDefinitionFile: path.join(projectRoot, "config", "DNA_DEFINITION.md"),
    dnaFactorsFile: path.join(projectRoot, "config", "DNA_FACTORS.md"),
    visionFile: path.join(projectRoot, "config", "VISION.md"),
    environmentFile: path.join(projectRoot, "config", "ENVIRONMENT.md"),
    dnaVectorFile: path.join(rootDir, "dna-vector.json"),
    dnaHistoryFile: path.join(rootDir, "dna-history.json"),
    workspaceDir,
    situationDir,
    stimuliDir,
    observationsDir,
    metricsDir,
    productionsDir,
    reviewsDir,
    publicationsDir,
    workspaceDirs,
    snapshotsDir: path.join(rootDir, "snapshots"),
    thoughtsDir: path.join(rootDir, "thoughts"),
    cellFile: path.join(rootDir, "cell.json"),
    inboxDir,
    inboxFile: path.join(inboxDir, "messages.json"),
    tasksDir,
    tasksFile: path.join(tasksDir, "tasks.json"),
    evolutionsDir: path.join(rootDir, "evolutions"),
    evolutionStateFile: path.join(rootDir, "evolution-state.json"),
    lifecycleEventsFile: path.join(rootDir, "lifecycle-events.json"),
    livingContextFile: path.join(rootDir, "living-context.json"),
    profileFile: path.join(rootDir, "profile.json"),
    memoryFiles: {
      identity: path.join(memoryDir, "identity.md"),
      rules: path.join(memoryDir, "rules.md"),
      knowledge: path.join(memoryDir, "knowledge.md"),
      history: path.join(memoryDir, "history.md"),
    },
  };
}
