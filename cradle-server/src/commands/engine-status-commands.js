import { renderTable } from "../ui/render-table.js";

export function createEngineStatusCommands() {
  return [
    {
      name: "/cells-status",
      match: (input, { engine }) =>
        input === "/cells-status" && engine.isCradleMode(),

      execute: async ({ engine }) => {
        renderCellsStatusTable(await buildCellsStatusRows(engine));
      },
    },

    {
      name: "/status",
      match: (input, { engine }) =>
        input === "/status" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        renderCurrentCellStatus(
          await buildCellStatusRow(engine, engine.getActiveCell())
        );
      },
    },

    {
      name: "/whoami",
      match: (input) => input === "/whoami",
      execute: async ({ engine }) => {
        if (engine.isCradleMode()) {
          renderCradleIdentity(engine);
          return;
        }

        const cell = engine.getActiveCell();

        renderCellIdentity({
          cell,
          inboxCount: engine.inboxes.get(cell.id)?.length ?? 0,
        });
      },
    },
  ];
}

export async function buildCellsStatusRows(engine) {
  const rows = [];

  for (const cell of engine.cells.values()) {
    rows.push(await buildCellStatusRow(engine, cell));
  }

  return rows;
}

export async function buildCellStatusRow(engine, cell) {
  const profile = await cell.getEvolutionInfo();
  const maturity = await cell.getMaturityInfo();
  const lifecycle = await cell.getLifecycleDecision();

  return {
    Cell: cell.id,
    Status: profile.status ?? "unknown",
    Active: cell.isActive() ? "yes" : "no",
    Mature: `${maturity.percent}%`,
    Life: lifecycle.action,
    State: maturity.state,
    Var: maturity.temporalVariance.toFixed(4),
    Conv: maturity.convergence.toFixed(2),
    Gen: profile.generation ?? 1,
    Inbox: engine.inboxes.get(cell.id)?.length ?? 0,
  };
}

export function renderCellsStatusTable(rows) {
  console.log("");

  renderTable(
    ["Cell", "Status", "Active", "Mature", "Life", "State", "Var", "Conv", "Gen", "Inbox"],
    rows
  );
}

export function renderCurrentCellStatus(status) {
  const items = [
    ["Cell", status.Cell],
    ["Status", status.Status],
    ["Active", status.Active],
    ["Maturity", status.Mature],
    ["Lifecycle", status.Life],
    ["Maturity State", status.State],
    ["Temporal Variance", status.Var],
    ["Convergence", status.Conv],
    ["Generation", status.Gen],
    ["Inbox", status.Inbox],
  ];

  console.log("");
  renderTable(
    ["Item", "Value"],
    items.map(([Item, Value]) => ({ Item, Value }))
  );
}

export function renderCradleIdentity(engine) {
  console.log(`
          Mode      : Cradle
          Role      : Engine Console
          Model     : ${engine.model}
          Cells     : ${engine.cells.size}
          `);
}

export function renderCellIdentity({
  cell,
  inboxCount,
}) {
  console.log(`
        Cell ID   : ${cell.id}
        Cell Name : ${cell.name}
        Model     : ${cell.model}
        Inbox     : ${inboxCount}
        `);
}
