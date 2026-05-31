import terminalKit from "terminal-kit";

const term = terminalKit.terminal;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MERLIN_LOGO = [
  "                    ███╗   ███╗███████╗██████╗ ██╗     ██╗███╗   ██╗",
  "                    ████╗ ████║██╔════╝██╔══██╗██║     ██║████╗  ██║",
  "                    ██╔████╔██║█████╗  ██████╔╝██║     ██║██╔██╗ ██║",
  "                    ██║╚██╔╝██║██╔══╝  ██╔══██╗██║     ██║██║╚██╗██║",
  "                    ██║ ╚═╝ ██║███████╗██║  ██║███████╗██║██║ ╚████║",
  "                    ╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝",
];

const MERLIN_CELL_MAP = `
              ● Customer Cell ──────── ● Payment Cell             ●
                    │                          │               ╱ │ ╲
                    ▼                          ▼             ●──●──●
              ● Order Cell ─────────── ● Risk Cell              ╲ │ ╱
                    │                          │                 ●
                    ▼                          ▼
              ● Notify Cell ────────── ● Model Cell
`;

const LOGO_COLORS = [
  term.brightMagenta,
  term.brightBlue,
  term.brightCyan,
  term.brightGreen,
  term.brightYellow,
  term.brightRed,
];

function renderMerlinLogo() {
  MERLIN_LOGO.forEach((line, index) => {
    LOGO_COLORS[index](line + "\n");
  });
}

function renderTagline() {
  term("\n");
  term("                     ");
  term.brightBlue("Software Life Engineering");
  term.gray(" | ");
  term.brightGreen("DNA Driven Design");
  term("\n\n");
}

function renderRuntimeStatus(model) {
  term.gray(`
     ──────────────────────────────────────────────────────────────────────────────
          🧠 Model: ${model}   |   ⚡ State: READY   |   📶 Mode: STREAMING
`);
}

export function clearScreen() {
  term.clear();
}

export function renderBoot(model) {
  renderMerlinLogo();
  renderTagline();

  term.brightCyan(MERLIN_CELL_MAP);

  renderRuntimeStatus(model);
}

export async function renderSummon() {
  term.green("\n⚡ Summoning Merlin Engine...\n");
  await sleep(300);

  term.green("🧬 Cells are connecting...\n");
  await sleep(300);

  term.green("🌱 Software life is growing...\n");
  await sleep(300);

  term.green("🧙 Merlin has awakened...\n");
}

export function renderSkill(skillName) {
  term.brightMagenta(`\n🧬 Cell activated: ${skillName}\n`);
}

export function renderSkillNotFound(skillName) {
  term.red(`\n⚠️ Cell not found: ${skillName}\n`);
}

export function renderAnswerStart() {
  term.brightBlue("\n🧙：");
}

export function writeAssistantChunk(chunk) {
  term.white(chunk);
}

export function renderPrompt() {
  return "\nMerlin > ";
}


export function renderIdle() {
  term.green("\n");
}

export function renderError(error) {
  term.red("\n☠ Failure\n");
  term.red(String(error?.message || error));
  term("\n");
}

export function renderBye() {
  term.green("\n🌙 Merlin Engine hibernating...\n");
}