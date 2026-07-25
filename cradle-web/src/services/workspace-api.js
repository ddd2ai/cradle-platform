export async function getWorkspace(cellId, { signal } = {}) {
  const response = await fetch(
    `/api/v1/cells/${encodeURIComponent(cellId)}/workspace`,
    { signal },
  );
  return await readWorkspaceResponse(response, "Failed to fetch workspace");
}

export async function getWorkspaceEntries(cellId, path = "", { signal } = {}) {
  const params = new URLSearchParams({ path });
  const response = await fetch(
    `/api/v1/cells/${encodeURIComponent(cellId)}/workspace/entries?${params.toString()}`,
    { signal },
  );
  return await readWorkspaceResponse(response, "Failed to fetch workspace entries");
}

export async function getWorkspaceFile(cellId, path, { signal } = {}) {
  const params = new URLSearchParams({ path });
  const response = await fetch(
    `/api/v1/cells/${encodeURIComponent(cellId)}/workspace/file?${params.toString()}`,
    { signal },
  );
  return await readWorkspaceResponse(response, "Failed to fetch workspace file");
}

export async function exportWorkspace(cellId, { signal } = {}) {
  const response = await fetch(
    `/api/v1/cells/${encodeURIComponent(cellId)}/workspace/export`,
    { signal },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      data?.error?.message ?? `Workspace export failed: ${response.status}`,
    );
  }

  return await response.blob();
}

async function readWorkspaceResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `${fallbackMessage}: ${response.status}`);
  }

  return data;
}
