export function renderCellGraph({ cellId, responsibilities = [], relationships = [] }) {
  console.log("");
  console.log(cellId);

  console.log("");
  console.log("Responsibilities");

  for (const item of responsibilities) {
    console.log(` ├─ ${item}`);
  }

  console.log("");
  console.log("Relationships");

  for (const link of relationships) {
    console.log(` ├─ ${link.type} -> ${link.target}`);
  }

  console.log("");
}

export function renderCellTrace({ cellId, relationships = [] }) {
  console.log("");
  console.log(`Trace: ${cellId}`);
  console.log("");

  if (relationships.length === 0) {
    console.log("(no relationships)");
    return;
  }

  for (const link of relationships) {
    console.log(`${cellId} --${link.type}--> ${link.target}`);
  }

  console.log("");
}
