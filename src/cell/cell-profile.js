export function createProfileDirectories(paths) {
  if (!paths) {
    throw new Error("createProfileDirectories requires paths");
  }

  return {
    root: paths.rootDir,
    logs: paths.logsDir,
    memory: paths.memoryDir,
    dna: paths.dnaDir,
    workspace: paths.workspaceDir,
    workspaceDirs: paths.workspaceDirs,
    snapshots: paths.snapshotsDir,
    thoughts: paths.thoughtsDir,
    inbox: paths.inboxDir,
  };
}

export function createDefaultCellProfile({
  id,
  name,
  model,
  paths,
  now = new Date().toISOString(),
} = {}) {
  if (!id) {
    throw new Error("createDefaultCellProfile requires id");
  }

  return {
    id,
    name,
    model,

    status: "idle",
    maturity: 0,
    generation: 1,
    parent: null,

    responsibilities: [],
    relationships: [],

    createdAt: now,
    updatedAt: now,
    lastStartedAt: now,

    directories: createProfileDirectories(paths),
  };
}

export function mergeCellProfileForStart({
  existingProfile,
  id,
  name,
  model,
  paths,
  now = new Date().toISOString(),
} = {}) {
  const defaultProfile = createDefaultCellProfile({
    id,
    name,
    model,
    paths,
    now,
  });

  if (!existingProfile) {
    return defaultProfile;
  }

  return {
    ...existingProfile,
    name: existingProfile.name || name,
    model,
    status: "idle",
    generation: existingProfile.generation ?? 1,
    parent: existingProfile.parent ?? null,
    updatedAt: now,
    lastStartedAt: now,
    directories: defaultProfile.directories,
  };
}
