import fs from "fs/promises";
import path from "path";

export function listCellDirectories(paths) {
  if (!paths) {
    throw new Error("listCellDirectories requires paths");
  }

  return [
    paths.logsDir,
    paths.memoryDir,
    paths.dnaDir,
    paths.workspaceDir,
    paths.workspaceDirs.notes,
    paths.workspaceDirs.tasks,
    paths.workspaceDirs.artifacts,
    paths.workspaceDirs.projects,
    paths.workspaceDirs.research,
    paths.workspaceDirs.decisions,
    paths.productionsDir,
    paths.reviewsDir,
    paths.publicationsDir,
    paths.snapshotsDir,
    paths.thoughtsDir,
    paths.inboxDir,
    paths.tasksDir,
    paths.evolutionsDir,
    paths.situationDir,
    paths.stimuliDir,
    path.join(paths.stimuliDir, "signals"),
    path.join(paths.stimuliDir, "threats"),
    path.join(paths.stimuliDir, "pressures"),
    path.join(paths.stimuliDir, "resources"),
    path.join(paths.stimuliDir, "processed"),
    paths.observationsDir,
    paths.metricsDir,
  ];
}

export async function prepareCellDirectories(paths) {
  await Promise.all(
    listCellDirectories(paths).map((dir) =>
      fs.mkdir(dir, { recursive: true })
    )
  );
}
