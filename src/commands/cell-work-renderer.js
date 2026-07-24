export function renderInbox(inbox = []) {
  if (inbox.length === 0) {
    console.log("(empty inbox)");
    return;
  }

  for (const message of inbox) {
    console.log(`
          [${message.type}] ${message.createdAt}
          From: ${message.from}
          To  : ${message.to}

          ${message.content}
          `);
  }
}

export function renderMetabolismResult(result) {
  console.log(`
Metabolism completed.

Created tasks : ${result.created}
Observation   : ${result.observationFile ?? "-"}
Reason        : ${result.reason ?? "-"}
`);
}

export function renderEvolutionResult(result) {
  if (!result.evolved) {
    console.log(`
Evolution skipped.

Reason       : ${result.reason}
Thought count: ${result.thoughtCount}
`);
    return;
  }

  console.log(`
Evolution completed.

File         : ${result.file}
Thoughts     : ${result.thoughtCount}
DNA drift    : ${result.dnaDrift.length}
`);
}

export function renderInboxProcessResult(result) {
  console.log(`
        Inbox processed.

        Messages:
        ${result.processed}

        ${result.summary}
        `);
}

export function renderTaskList(tasks = []) {
  if (tasks.length === 0) {
    console.log("(no tasks)");
    return;
  }

  for (const task of tasks) {
    console.log(`
          [${task.status}] ${task.id}
          ${task.title}
          source: ${task.source}
          `);
  }
}
