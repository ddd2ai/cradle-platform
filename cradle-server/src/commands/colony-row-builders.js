export async function buildWorkRows(engine) {
  const rows = [];

  for (const [id, cell] of engine.cells) {
    const inbox = await cell.readInbox();
    const tasks = await cell.readTasks();

    const pendingTasks =
      tasks.filter((task) => task.status === "pending");

    engine.inboxes.set(id, inbox);

    rows.push({
      Cell: id,
      Inbox: inbox.length,
      Tasks: pendingTasks.length,
      Action:
        inbox.length > 0
          ? "process"
          : pendingTasks.length > 0
            ? "todo"
            : "idle",
    });
  }

  return rows;
}

export async function buildEvolutionRows(engine, {
  includeLast = false,
} = {}) {
  const rows = [];

  for (const [id, cell] of engine.cells) {
    const status = await cell.getEvolutionStatus();
    const row = {
      Cell: id,
      Thoughts: status.totalThoughts,
      Unevolved: status.unevolvedThoughts,
      Evolved: status.evolvedThoughts,
      Evolutions: status.evolutionCount,
      Next: status.nextEvolutionIn,
    };

    if (includeLast) {
      row.Last = status.lastEvolvedAt;
    }

    rows.push(row);
  }

  return rows;
}

export async function buildDnaMatrixRows(engine) {
  const rows = [];

  for (const [id, cell] of engine.cells) {
    const dna = await cell.getDNARank();

    rows.push({
      Cell: id,
      "Dominant DNA": dna.dominantDNA,
      Score: dna.score.toFixed(2),
      PER: dna.scores.PERCEPTION.toFixed(2),
      DEC: dna.scores.DECISION.toFixed(2),
      DEP: dna.scores.DECOMPOSITION.toFixed(2),
      LEA: dna.scores.LEARNING.toFixed(2),
      COL: dna.scores.COLLABORATION.toFixed(2),
      CRE: dna.scores.CREATION.toFixed(2),
      EVO: dna.scores.EVOLUTION.toFixed(2),
      REF: dna.scores.REFLECTION.toFixed(2),
    });
  }

  return rows;
}

export async function buildWatchStatusRows(engine) {
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
