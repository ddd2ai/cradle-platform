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
