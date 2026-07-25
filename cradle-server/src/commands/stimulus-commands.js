import path from "path";
import { renderAnswerStart } from "../cradle-console.js";
import { getAiTimeoutMs } from "../cradle-config.js";
import { writeTextFile } from "../utils/text-file.js";
import { createPerceptionPrompt } from "./cell-command-prompts.js";
import { renderStimuliList } from "./cell-list-renderer.js";
import { renderMetabolismResult } from "./cell-work-renderer.js";

export function createStimulusCommands() {
  return [
    {
      name: "/observe",
      match: (input, { engine }) =>
        input === "/observe" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const stimuli = await cell.readStimuli();

        renderStimuliList(stimuli);
      },
    },

    {
      name: "/perceive",
      match: (input, { engine }) =>
        input === "/perceive" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const stimuli = await cell.readStimuli();

        if (stimuli.length === 0) {
          console.log("(no stimuli)");
          return;
        }

        renderAnswerStart();
        console.log("🧬 Reading situation stimuli...");
        console.log("🧠 Perceiving...");

        const result = await cell.askWithTimeout(
          createPerceptionPrompt({
            memoryContext: await cell.buildMemoryContext(),
            stimuli,
          }),
          getAiTimeoutMs()
        );

        const outputText = engine.cleanMarkdownFence(
          result?.text ?? result?.answer ?? ""
        );

        const filename =
          `observation-${engine.formatTimestamp(new Date())}.md`;

        await writeTextFile(
          path.join(cell.observationsDir, filename),
          outputText
        );

        console.log(`\nObservation created: situation/observations/${filename}`);
      },
    },

    {
      name: "/metabolize",
      match: (input, { engine }) =>
        input === "/metabolize" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        console.log("🧬 Reading stimuli...");
        console.log("🧠 Creating tasks from situation...");

        const result = await cell.metabolize();

        renderMetabolismResult(result);
      },
    },
  ];
}
