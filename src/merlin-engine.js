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
  renderIdle,
  renderError,
  renderBye,
} from "./merlin-ui.js";

const MODEL = process.env.MODEL || "gpt-4.1";

clearScreen();
renderBoot(MODEL);
await renderSummon();

const assistant = await createMerlinAssistant({
  model: MODEL,
  onDelta: writeAssistantChunk,
  onIdle: renderIdle,
  onError: renderError,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function loop() {
  rl.question(renderPrompt(), async (input) => {
    const trimmed = input.trim();

    if (trimmed === "exit") {
      await cleanup();
      return;
    }

    if (!trimmed) {
      return loop();
    }

    try {
      const skillName = detectSkillName(trimmed);

      if (skillName) {
        renderSkill(skillName);
      }

      renderAnswerStart();

      const result = await assistant.ask(trimmed);

      if (result.skillMissing) {
        renderSkillNotFound(result.skillMissing);
      }
    } catch (error) {
      renderError(error);
    }

    loop();
  });
}

function detectSkillName(input) {
  if (!input.startsWith("/")) {
    return null;
  }

  const [command] = input.split(" ");
  return command.replace("/", "");
}

async function cleanup() {
  renderBye();
  rl.close();
  await assistant.cleanup();
}

loop();