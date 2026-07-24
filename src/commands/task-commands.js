import { renderAnswerStart } from "../cradle-console.js";
import { createTaskArtifactPrompt } from "./cell-command-prompts.js";
import { renderTaskList } from "./cell-work-renderer.js";

export function createTaskCommands() {
  return [
    {
      name: "/tasks",
      match: (input, { engine }) =>
        input === "/tasks" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const tasks = await cell.readTasks();

        renderTaskList(tasks);
      },
    },

    {
      name: "/do",

      match: (input, { engine }) =>
        input === "/do" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const task = await cell.nextPendingTask();

        if (!task) {
          console.log("(no pending task)");
          return;
        }

        renderAnswerStart();

        const result = await cell.ask(createTaskArtifactPrompt(task));

        const outputText =
          engine.cleanMarkdownFence(result?.text ?? result?.answer ?? "");

        const filename = `artifacts/${task.id}.md`;

        await cell.writeWorkspaceFile(filename, outputText);
        await cell.completeTask(task.id);

        console.log(`\nArtifact created: ${filename}`);
      },
    },
  ];
}
