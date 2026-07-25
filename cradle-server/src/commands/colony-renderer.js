import { renderTable } from "../ui/render-table.js";

export function renderWorkTable(rows) {
  console.log("");

  renderTable(
    ["Cell", "Inbox", "Tasks", "Action"],
    rows
  );
}

export function renderEvolutionStatusTable(rows) {
  console.log("");

  renderTable(
    [
      "Cell",
      "Thoughts",
      "Unevolved",
      "Evolved",
      "Evolutions",
      "Next",
      "Last",
    ],
    rows
  );
}

export function renderDnaMatrix(rows) {
  console.log("");
  console.log("DNA Matrix");

  renderTable(
    [
      "Cell",
      "Dominant DNA",
      "Score",
      "PER",
      "DEC",
      "DEP",
      "LEA",
      "COL",
      "CRE",
      "EVO",
      "REF",
    ],
    rows
  );
}

export function renderColonyStatus(cells) {
  console.log("");
  console.log("🧫 Cradle Colony");
  console.log("");

  for (const cell of cells) {
    console.log(cell.id);
    console.log(` ├─ status: ${cell.status ?? "unknown"}`);
    console.log(` ├─ maturity: ${cell.maturity.percent}% (${cell.maturity.state})`);
    console.log(` ├─ variance: ${cell.maturity.temporalVariance.toFixed(6)}`);
    console.log(` ├─ convergence: ${cell.maturity.convergence.toFixed(4)}`);
    console.log(` ├─ magnitude: ${cell.maturity.normalizedMagnitude.toFixed(4)}`);
    console.log(` ├─ generation: ${cell.generation ?? 1}`);
    console.log(` ├─ parent: ${cell.parent ?? "-"}`);
    console.log(` ├─ inbox: ${cell.inboxCount}`);

    console.log(" ├─ responsibilities:");

    if (cell.responsibilities.length === 0) {
      console.log(" │   └─ -");
    } else {
      for (const item of cell.responsibilities) {
        console.log(` │   └─ ${item}`);
      }
    }

    console.log(" └─ relationships:");

    if (cell.relationships.length === 0) {
      console.log("     └─ -");
    } else {
      for (const link of cell.relationships) {
        console.log(`     └─ ${link.type} -> ${link.target}`);
      }
    }

    console.log("");
  }
}

export function renderLiveWatch({
  now = new Date(),
  statusRows,
  workRows,
  evolutionRows,
}) {
  console.clear();

  console.log("🧫 Cradle Live Watch");
  console.log(`Updated at: ${now.toLocaleString()}`);
  console.log("");

  console.log("Status");
  renderTable(
    ["Cell", "Status", "Active", "Mature", "Life", "State", "Var", "Conv", "Gen", "Inbox"],
    statusRows
  );

  console.log("");
  console.log("Work");
  renderTable(
    ["Cell", "Inbox", "Tasks", "Action"],
    workRows
  );

  console.log("");
  console.log("Evolution");
  renderTable(
    [
      "Cell",
      "Thoughts",
      "Unevolved",
      "Evolved",
      "Evolutions",
      "Next",
    ],
    evolutionRows
  );

  console.log("");
  console.log("Use /unwatch to stop live watch.");
}
