export function renderStimuliList(stimuli = []) {
  if (stimuli.length === 0) {
    console.log("(no stimuli)");
    return;
  }

  console.log("");
  console.log("Situation Stimuli");
  console.log("");

  for (const item of stimuli) {
    console.log(`[${item.category}] ${item.file}`);
  }
}

export function renderWorkspaceSections(sections = {}) {
  console.log("");
  console.log("Workspace");
  console.log("");

  for (const [section, files] of Object.entries(sections)) {
    console.log(`${section}/`);

    if (files.length === 0) {
      console.log("  └─ -");
    } else {
      for (const file of files) {
        console.log(`  └─ ${file}`);
      }
    }

    console.log("");
  }
}

export function renderSnapshotList(snapshots = []) {
  console.log(snapshots.length ? snapshots.join("\n") : "(no snapshots)");
}

export function renderEvolutionFileList(files = []) {
  console.log("");

  files
    .filter((file) => file.endsWith(".md"))
    .sort()
    .forEach((file) => console.log(file));

  console.log("");
}
