export function renderFullMemory({
  identity,
  rules,
  knowledge,
  history,
}) {
  console.log(`
        # Identity

        ${identity}

        ---

        # Rules

        ${rules}

        ---

        # Knowledge

        ${knowledge}

        ---

        # History

        ${history}
        `);
}
