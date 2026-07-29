export async function fetchCells() {
  const response = await fetch("/api/v1/cells");

  if (!response.ok) {
    throw new Error(`Failed to fetch cells: ${response.status}`);
  }

  const data = await response.json();
  const loadedCells = Array.isArray(data) ? data : data.cells ?? [];

  return loadedCells.map((cell) => ({
    ...cell,
    id: cell.id ?? cell.cellId,
  }));
}

export async function fetchCreations() {
  const response = await fetch("/api/v1/creations");

  if (!response.ok) {
    throw new Error(`Failed to fetch creations: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function createCell(cellId) {
  const response = await fetch("/api/v1/cells", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cellId }),
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ?? `Failed to create cell: ${response.status}`,
    );
  }

  const cell = data.cell ?? data;

  return {
    ...cell,
    id: cell.id ?? cell.cellId,
  };
}

export async function fetchCell(cellId) {
  const response = await fetch(
    `/api/v1/cells/${encodeURIComponent(cellId)}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch cell ${cellId}: ${response.status}`,
    );
  }

  const data = await response.json();
  return data.cell ?? data;
}

export async function fetchCellDna(cellId) {
  const response = await fetch(
    `/api/v1/cells/${encodeURIComponent(cellId)}/dna`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch cell DNA ${cellId}: ${response.status}`,
    );
  }

  return response.json();
}

export async function fetchCellWorkspace(cellId) {
  const response = await fetch(
    `/api/v1/cells/${encodeURIComponent(cellId)}/workspace`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch cell workspace ${cellId}: ${response.status}`,
    );
  }

  return response.json();
}

export async function fetchCellMaturity(cellId) {
  const response = await fetch(
    `/api/v1/cells/${encodeURIComponent(cellId)}/maturity`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch cell maturity ${cellId}: ${response.status}`,
    );
  }

  return response.json();
}

export async function fetchCellLifecycleDecision(cellId) {
  const response = await fetch(
    `/api/v1/cells/${encodeURIComponent(cellId)}/lifecycle-decision`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch cell lifecycle decision ${cellId}: ${response.status}`,
    );
  }

  return response.json();
}

export async function activateCell(cellId) {
  return postCellAction(cellId, "activate");
}

export async function deactivateCell(cellId) {
  return postCellAction(cellId, "deactivate");
}

export async function activateAllCells() {
  return postCellsAction("activate-all");
}

export async function deactivateAllCells() {
  return postCellsAction("deactivate-all");
}

/**
 * @typedef {Object} StabilizeCellResponse
 * @property {string} cellId
 * @property {"completed"} status
 * @property {boolean} diagnosed
 * @property {boolean} patched
 * @property {boolean} verified
 * @property {string} result
 */

/**
 * @param {string} cellId
 * @returns {Promise<StabilizeCellResponse>}
 */
export async function stabilizeCell(cellId) {
  return postJson(
    `/api/v1/cells/${encodeURIComponent(cellId)}/stabilize`,
  );
}

/**
 * @typedef {Object} DivideCellRequest
 * @property {string} childCellId
 */

/**
 * @typedef {Object} DivideCellResponse
 * @property {string} parentCellId
 * @property {string} childCellId
 * @property {"completed"|"incomplete"} status
 * @property {boolean} complete
 * @property {Array<Object>} errors
 */

/**
 * @param {string} cellId
 * @param {DivideCellRequest} request
 * @returns {Promise<DivideCellResponse>}
 */
export async function divideCell(cellId, request) {
  return postJson(
    `/api/v1/cells/${encodeURIComponent(cellId)}/divide`,
    request,
  );
}

/**
 * @typedef {Object} FuseCellsRequest
 * @property {string[]} parentCellIds
 * @property {string} childCellId
 */

/**
 * @typedef {Object} FuseCellsResponse
 * @property {string[]} parentCellIds
 * @property {string} childCellId
 * @property {"completed"|"incomplete"|"failed"} status
 * @property {boolean} complete
 * @property {Array<Object>} errors
 */

/**
 * @param {FuseCellsRequest} request
 * @returns {Promise<FuseCellsResponse>}
 */
export async function fuseCells(request) {
  return postJson("/api/v1/cells/fuse", request);
}

/**
 * @typedef {Object} FeedCellRequest
 * @property {string} content
 */

/**
 * @typedef {Object} FeedCellResponse
 * @property {string} cellId
 * @property {Object} message
 */

/**
 * @param {string} cellId
 * @param {FeedCellRequest} request
 * @returns {Promise<FeedCellResponse>}
 */
export async function feedCell(cellId, request) {
  return postJson(
    `/api/v1/cells/${encodeURIComponent(cellId)}/feed`,
    request,
  );
}

export async function heartbeatCell() {
  const response = await fetch("/api/v1/heartbeat/runs", { method: "POST" });

  if (!response.ok) {
    throw new Error(`Failed to start heartbeat: ${response.status}`);
  }

  const accepted = await response.json();
  if (!accepted.operationId) return accepted;

  return waitForOperation(accepted.operationId);
}

export async function startCultivation() {
  return heartbeatCell();
}

export async function stopCultivation() {
  const response = await fetch("/api/v1/heartbeat/mode", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "manual" }),
  });

  if (!response.ok) {
    throw new Error(`Failed to stop cultivation: ${response.status}`);
  }

  return response.json();
}

export async function fetchCultivationStatus() {
  const response = await fetch("/api/v1/cultivation/status");

  if (!response.ok) {
    throw new Error(`Failed to fetch cultivation status: ${response.status}`);
  }

  return response.json();
}

export async function fetchAiSettings() {
  const response = await fetch("/api/v1/ai/settings");

  if (!response.ok) {
    throw new Error(`Failed to fetch AI settings: ${response.status}`);
  }

  return response.json();
}

export async function updateAiSettings({ provider, model }) {
  const response = await fetch("/api/v1/ai/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider, model }),
  });
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ?? `Failed to update AI settings: ${response.status}`,
    );
  }

  return data;
}

export async function fetchCradleConfig() {
  const response = await fetch("/api/v1/config");
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ?? `Failed to fetch configuration: ${response.status}`,
    );
  }

  return data;
}

export async function updateCradleConfig(config) {
  const response = await fetch("/api/v1/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ?? `Failed to update configuration: ${response.status}`,
    );
  }

  return data;
}

export async function fetchLogs() {
  const response = await fetch("/api/v1/logs");

  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.status}`);
  }

  const data = await response.json();

  return data.logs ?? [];
}

export async function clearLogs() {
  const response = await fetch("/api/v1/logs", { method: "DELETE" });

  if (!response.ok) {
    throw new Error(`Failed to clear logs: ${response.status}`);
  }

  const data = await response.json();

  return data.logs ?? [];
}

async function waitForOperation(operationId) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    const response = await fetch(
      `/api/v1/operations/${encodeURIComponent(operationId)}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to read heartbeat operation: ${response.status}`);
    }

    const { operation } = await response.json();
    if (operation.status === "completed") return operation;
    if (operation.status === "failed") {
      throw new Error(operation.error?.message ?? "Heartbeat operation failed");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  throw new Error("Heartbeat operation timed out");
}

async function postCellAction(cellId, action) {
  const response = await fetch(
    `/api/v1/cells/${encodeURIComponent(cellId)}/${action}`,
    { method: "POST" },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to ${action} cell ${cellId}: ${response.status}`,
    );
  }

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return null;
}

async function postCellsAction(action) {
  const response = await fetch(`/api/v1/cells/${action}`, { method: "POST" });

  if (!response.ok) {
    throw new Error(`Failed to ${action.replace("-", " ")} cells: ${response.status}`);
  }

  const data = await response.json();
  const loadedCells = data.cells ?? [];

  return {
    cells: loadedCells.map((cell) => ({
      ...cell,
      id: cell.id ?? cell.cellId,
    })),
    cultivation: data.cultivation ?? null,
  };
}

async function postJson(path, body) {
  let response;

  try {
    response = await fetch(path, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Backend unavailable");
  }

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message = data?.error?.message;
    const errorMessage =
      typeof message === "string"
        ? message
        : `Request failed: ${response.status}`;

    throw new Error(errorMessage);
  }

  return data;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return null;
  }

  return response.json();
}
