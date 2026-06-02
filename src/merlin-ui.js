import terminalKit from "terminal-kit";

const term = terminalKit.terminal;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MERLIN_ID = "Merlin";



function renderMerlinLogo() {

  const dnaColors = [
    term.brightMagenta,
    term.magenta,
    term.brightRed,
    term.red,
    term.brightYellow,
    term.yellow,
  ];

  const helixColors = [
    term.brightMagenta,
    term.magenta,
    term.brightBlue,
    term.blue,
    term.cyan,
    term.brightCyan,
  ];

  const cradleColors = [
    term.brightCyan,
    term.cyan,
    term.brightBlue,
    term.blue,
    term.brightCyan,
    term.cyan,
  ];

  const dnaTexts = [
    "    ██████╗ ███╗   ██╗ █████╗ ",
    "    ██╔══██╗████╗  ██║██╔══██╗",
    "    ██║  ██║██╔██╗ ██║███████║",
    "    ██║  ██║██║╚██╗██║██╔══██║",
    "    ██████╔╝██║ ╚████║██║  ██║",
    "    ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝",
  ];

  const helixTexts = [
    "  ██──────██ ",
    "    ██──██   ",
    "      ███    ",
    "     ███     ",
    "    ██──██   ",
    "  ██──────██ ",
  ];

  const cradleTexts = [
    "  ██████╗██████╗  █████╗ ██████╗ ██╗     ███████╗",
    " ██╔════╝██╔══██╗██╔══██╗██╔══██╗██║     ██╔════╝",
    " ██║     ██████╔╝███████║██║  ██║██║     █████╗",
    " ██║     ██╔══██╗██╔══██║██║  ██║██║     ██╔══╝",
    " ╚██████╗██║  ██║██║  ██║██████╔╝███████╗███████╗",
    "  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚══════╝",
  ];

  for (let i = 0; i < 6; i++) {

    dnaColors[i](dnaTexts[i]);

    helixColors[i](helixTexts[i]);

    cradleColors[i](cradleTexts[i]);

    term("\n");
  }
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
            Model: ${model}   |     State: READY   |     Mode: STREAMING
            
`);
}

export function clearScreen() {
  term.clear();
}

export function renderBoot(model) {

  const LOGO_CELL_MAP = `
                ● Customer Cell ──────── ● Payment Cell             ●
                      │                          │                ╱ │ ╲
                      ▼                          ▼               ●──●──●●──●
                ● Order Cell ─────────── ● Risk Cell              ╲ │ ╱
                      │                          │                 ●●──●
                      ▼                          ▼                ╱    
                ● Notify Cell ────────── ● Model Cell            ●
  `;

  renderMerlinLogo();
  renderTagline();

  term.brightCyan(LOGO_CELL_MAP);

  renderRuntimeStatus(model);
}

export async function renderSummon() {

  term.green("🧬 Starting DNA Cradle...\n");
  await sleep(300);

  term.green("🦠 Cells are connecting...\n");
  await sleep(300);

  term.green("🌾 Software life is growing...\n");
  await sleep(300);

  term.green("🧫 DNA Cradle is ready!\n");
}

export function renderSkill(skillName) {
  term.brightMagenta(`\n🦠 Cell activated: ${skillName}\n`);
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

export function renderPrompt(cellId = MERLIN_ID) {
  if (cellId === MERLIN_ID) {
    return "🔬 Merlin > ";
  }

  return `🦠 ${cellId} > `;
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