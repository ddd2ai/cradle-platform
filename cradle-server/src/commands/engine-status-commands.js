import { renderTable } from "../ui/render-table.js";

export function createEngineStatusCommands() {
  return [
    {
      name: "/status",
      match: (input) => input === "/status",

      execute: async ({ engine }) => {
        renderEngineStatus(await buildEngineStatusRows(engine));
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

export async function buildEngineStatusRows(engine) {
  const rows = [];

  for (const [id, cell] of engine.cells) {
    const profile = await cell.getEvolutionInfo();
    const maturity = await cell.getMaturityInfo();
    const lifecycle = await cell.getLifecycleDecision();

    rows.push({
      Cell: id,
      Status: profile.status ?? "unknown",
      Active: cell.isActive() ? "yes" : "no",
      Mature: `${maturity.percent}%`,
      Life: lifecycle.action,
      State: maturity.state,
      Var: maturity.temporalVariance.toFixed(4),
      Conv: maturity.convergence.toFixed(2),
      Gen: profile.generation ?? 1,
      Inbox: engine.inboxes.get(id)?.length ?? 0,
    });
  }

  return rows;
}

export function renderEngineStatus(rows) {
  console.log("");

  renderTable(
    ["Cell", "Status", "Active", "Mature", "Life", "State", "Var", "Conv", "Gen", "Inbox"],
    rows
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
