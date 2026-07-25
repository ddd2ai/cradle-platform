export function renderColonyGraph(nodes) {
  if (!nodes.length) {
    console.log("(empty colony)");
    return;
  }

  console.log("");
  console.log("🧬 Cradle Colony Graph");
  console.log("");

  const roots = nodes.filter((node) => !findParent(node));

  for (const root of roots) {
    printTree(root, nodes, "", true, true);
  }

  console.log("");
  console.log("Relationships");
  console.log("");

  let hasRelationship = false;

  for (const node of nodes) {
    for (const link of node.relationships ?? []) {
      hasRelationship = true;
      console.log(`  ${node.id} ── ${link.type} ──▶ ${link.target}`);
    }
  }

  if (!hasRelationship) {
    console.log("  (no relationships)");
  }

  console.log("");
}

function printTree(node, nodes, prefix = "", isRoot = true, isLast = true) {
  const connector = isRoot ? "" : isLast ? "└─ " : "├─ ";

  console.log(`${prefix}${connector}● ${node.id}`);

  const children = nodes.filter((child) => findParent(child) === node.id);

  children.forEach((child, index) => {
    const last = index === children.length - 1;

    const nextPrefix = isRoot
      ? ""
      : prefix + (isLast ? "   " : "│  ");

    printTree(child, nodes, nextPrefix, false, last);
  });
}

function findParent(node) {
  const bornFrom = (node.relationships ?? []).find(
    (link) => link.type === "born-from"
  );

  return node.parent ?? bornFrom?.target ?? null;
}