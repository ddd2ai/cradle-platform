import readline from "readline";
import { createMerlinAssistant } from "./merlin-ai.js";
import {
  clearScreen,
  renderBoot,
  renderSummon,
  renderSkill,
  renderSkillNotFound,
  renderAnswerStart,
  writeAssistantChunk,
  renderPrompt,
  renderError,
  renderBye,
} from "./merlin-ui.js";

export class MerlinCell {
  constructor({ name = "Merlin Cell", model = "gpt-4.1" } = {}) {
    this.name = name;
    this.model = model;
    this.assistant = null;
    this.rl = null;
  }

  async start() {
    clearScreen();
    renderBoot(this.model);
    await renderSummon();

    this.assistant = await createMerlinAssistant({
      model: this.model,
      onDelta: writeAssistantChunk,
      onError: renderError,
    });

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await this.loop();
  }

  async loop() {
    this.rl.question(renderPrompt(), async (input) => {
      const trimmed = input.trim();

      if (trimmed === "exit") {
        await this.shutdown();
        return;
      }

      if (!trimmed) {
        return this.loop();
      }

      try {
        renderAnswerStart();

        const result = await this.assistant.ask(trimmed);

        if (result.usedSkill) {
          renderSkill(result.usedSkill);
        }

        if (result.skillMissing) {
          renderSkillNotFound(result.skillMissing);
        }
      } catch (error) {
        renderError(error);
      }

      this.loop();
    });
  }

  async shutdown() {
    renderBye();
    this.rl?.close();
    await this.assistant?.cleanup();
  }
}