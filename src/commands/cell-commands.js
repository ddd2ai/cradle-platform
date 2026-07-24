import fs from "fs/promises";
import path from "path";
import { renderAnswerStart } from "../cradle-console.js";
import { block } from "../utils/text.js";
import { getAiTimeoutMs } from "../cradle-config.js";
import { commandArgs, splitFirstArg } from "./command-input.js";
import { writeTextFile } from "../utils/text-file.js";
import {
  renderDivisionBeforeChildFailure,
  renderDivisionReadiness,
  renderDivisionResult,
} from "./division-renderer.js";
import {
  createDecisionDocument,
  createNoteDocument,
  createProjectFileDocument,
  createProjectReadmeDocument,
  createResearchDocument,
} from "./workspace-document-templates.js";

export function createCellCommands() {
  return [
    {
      name: "/inbox",
      match: (input, { engine }) => input === "/inbox" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const inbox = await cell.readInbox();
        engine.inboxes.set(cell.id, inbox);

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
      },
    },

    {
      name: "/send",
      match: (input, { engine }) => input.startsWith("/send ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const { first: targetCellId, rest: message } =
          splitFirstArg(input, "/send");

        if (!targetCellId || !message) {
          console.log("Usage: /send <cell-id> <message>");
          return;
        }

        if (!engine.cells.has(targetCellId)) {
          console.log(`Target cell not found: ${targetCellId}`);
          return;
        }

        await engine.pushMessage({
          from: cell.id,
          to: targetCellId,
          type: "message",
          content: message,
        });

        console.log(`Message sent from ${cell.id} to ${targetCellId}`);
      },
    },

    {
      name: "/memory",
      match: (input, { engine }) => input === "/memory" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        console.log(await engine.getActiveCell().buildMemoryContext());
      },
    },

    {
      name: "/prompt",
      match: (input, { engine }) => input === "/prompt" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        console.log(await cell.buildCellSystemPrompt());
      },
    },

    {
      name: "/dna init",
      match: (input, { engine }) =>
        input === "/dna init" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        console.log("🧬 Initializing DNA traits...");
        console.log("🧠 Asking AI to seed cell DNA...");

        renderAnswerStart();

        await cell.initDNA();

        console.log("\nDNA initialized.");
      },
    },

    {
      name: "/dna",
      match: (input, { engine }) =>
        input === "/dna" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        console.log(await cell.readDNAContext());
      },
    },

    {
      name: "/dna-history",

      match: (input, { engine }) =>
        input === "/dna-history" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {

        const cell =
          engine.getActiveCell();

        const history =
          await cell.readDNAHistory();

        console.log("");

        if (history.length === 0) {
          console.log("(empty dna history)");
          return;
        }

        history
          .slice(-10)
          .forEach((item, index) => {

            console.log(
              `[${index + 1}] ${item.at} (${item.reason})`
            );
          });

        console.log("");
      },
    },

    {
      name: "/maturity",
      match: (input, { engine }) =>
        input === "/maturity" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const maturity = await cell.getMaturityInfo();

        console.log(`
DNA Maturity

Maturity       : ${maturity.percent}%
State          : ${maturity.state}
Sample Size    : ${maturity.sampleSize}
Magnitude      : ${maturity.magnitude.toFixed(4)}
Normalized     : ${maturity.normalizedMagnitude.toFixed(4)}
Variance       : ${maturity.temporalVariance.toFixed(6)}
Convergence    : ${maturity.convergence.toFixed(4)}

Trait Scores:
${Object.entries(maturity.currentTraitScores)
  .map(([trait, value]) => `  ${trait.padEnd(20)}: ${Number(value).toFixed(4)}`)
  .join("\n")}
`);
      },
    },

    {
      name: "/lifecycle",
      match: (input, { engine }) =>
        input === "/lifecycle" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        const maturity = await cell.getMaturityInfo();
        const decision = await cell.getLifecycleDecision();

        console.log(`
Cell Lifecycle Decision

Cell             : ${cell.id}
Action           : ${decision.action}
Confidence       : ${decision.confidence}
Reason           : ${decision.reason}

DNA Maturity
- Maturity        : ${maturity.percent}%
- State           : ${maturity.state}
- Sample Size     : ${maturity.sampleSize}
- Variance        : ${maturity.temporalVariance.toFixed(6)}
- Convergence     : ${maturity.convergence.toFixed(4)}
- Magnitude       : ${maturity.normalizedMagnitude.toFixed(4)}

Lifecycle Detail
${Object.entries(decision.detail ?? {})
  .map(([key, value]) => {
    if (typeof value === "number") {
      return `- ${key.padEnd(25)}: ${value.toFixed(6)}`;
    }

    if (typeof value === "object" && value !== null) {
      return `- ${key.padEnd(25)}: ${JSON.stringify(value)}`;
    }

    return `- ${key.padEnd(25)}: ${value}`;
  })
  .join("\n")}
`);
      },
    },

    {
      name: "/memory full",
      match: (input, { engine }) => input === "/memory full" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        console.log(`
        # Identity

        ${await cell.safeReadMemory("identity")}

        ---

        # Rules

        ${await cell.safeReadMemory("rules")}

        ---

        # Knowledge

        ${await cell.safeReadMemory("knowledge")}

        ---

        # History

        ${await cell.safeReadMemory("history")}
        `);
      },
    },

    {
      name: "/thoughts",
      match: (input, { engine }) => input === "/thoughts" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        console.log(await engine.getActiveCell().readRecentThoughts(12000));
      },
    },

    {
      name: "/think",

      match: (input, { engine }) =>
        input === "/think" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        console.log("🧬 Reading DNA and memory...");
        console.log("🧠 Thinking...");

        renderAnswerStart();

        await cell.think();

        console.log("\nThought created.");
      },
    },

    {
      name: "/observe",
      match: (input, { engine }) =>
        input === "/observe" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const stimuli = await cell.readStimuli();

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

        const result = await cell.askWithTimeout(`
        請根據目前的 Cell DNA、Memory、Vision、Environment,觀察以下 situation stimuli。

        請產生一份 Observation,包含：

        - 觀察摘要
        - 對目前 Cell 的影響
        - 可能牽動的 DNA trait
        - 建議下一步行動

        # Cell Context

        ${await cell.buildMemoryContext()}

        # Stimuli

        ${stimuli.map((s) => `
        ## ${s.category}/${s.file}

        ${s.content}
        `).join("\n\n")}
        `, getAiTimeoutMs());

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

        console.log(`
Metabolism completed.

Created tasks : ${result.created}
Observation   : ${result.observationFile ?? "-"}
Reason        : ${result.reason ?? "-"}
`);
      },
    },

    {
      name: "/feed",
      match: (input, { engine }) => input.startsWith("/feed ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = commandArgs(input, "/feed");

        if (!content) {
          console.log("Usage: /feed <content>");
          return;
        }

        await cell.appendKnowledge(
          block([
            `## ${new Date().toISOString()}`,
            "",
            content,
            "",
          ])
        );
        console.log("Memory updated.");
      },
    },

    {
      name: "/write",
      match: (input, { engine }) => input.startsWith("/write ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = commandArgs(input, "/write");

        if (!content) {
          console.log("Usage: /write <task>");
          return;
        }

        const filename = `artifacts/note-${engine.formatTimestamp(new Date())}.md`;

        renderAnswerStart();

        const result = await cell.ask(`
        請根據以下任務產生一份 Markdown 文件內容。

        任務：
        ${content}

        請只輸出 Markdown 內容，不要額外解釋。
        `);

        const outputText = engine.cleanMarkdownFence(result?.text ?? result?.answer ?? "");

        await cell.writeWorkspaceFile(filename, outputText);

        console.log(`\nWorkspace file created: ${filename}`);
      },
    },

    {
      name: "/write-note",
      match: (input, { engine }) =>
        input.startsWith("/write-note ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = commandArgs(input, "/write-note");

        if (!content) {
          console.log("Usage: /write-note <content>");
          return;
        }

        const filename = `notes/note-${engine.formatTimestamp(new Date())}.md`;

        await cell.writeWorkspaceFile(
          filename,
          createNoteDocument({
            content,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Note created: ${filename}`);
      },
    },

    {
      name: "/decide",
      match: (input, { engine }) =>
        input.startsWith("/decide ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = commandArgs(input, "/decide");

        if (!content) {
          console.log("Usage: /decide <decision>");
          return;
        }

        const filename = `decisions/decision-${engine.formatTimestamp(new Date())}.md`;

        await cell.writeWorkspaceFile(
          filename,
          createDecisionDocument({
            content,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Decision created: ${filename}`);
      },
    },

    {
      name: "/research",
      match: (input, { engine }) =>
        input.startsWith("/research ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = commandArgs(input, "/research");

        if (!content) {
          console.log("Usage: /research <content>");
          return;
        }

        const filename = `research/research-${engine.formatTimestamp(new Date())}.md`;

        await cell.writeWorkspaceFile(
          filename,
          createResearchDocument({
            content,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Research created: ${filename}`);
      },
    },

    {
      name: "/read",
      match: (input, { engine }) => input.startsWith("/read ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const fileName = commandArgs(input, "/read");

        if (!fileName) {
          console.log("Usage: /read <workspace-file>");
          return;
        }

        try {
          const content = await cell.readWorkspaceFile(fileName);
          console.log(content);
        } catch {
          console.log(`Workspace file not found: ${fileName}`);
        }
      },
    },

    {
      name: "/revise",
      match: (input, { engine }) => input.startsWith("/revise ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const { first: fileName, rest: task } =
          splitFirstArg(input, "/revise");

        if (!fileName || !task) {
          console.log("Usage: /revise <workspace-file> <task>");
          return;
        }

        let originalContent = "";

        try {
          originalContent = await cell.readWorkspaceFile(fileName);
        } catch {
          console.log(`Workspace file not found: ${fileName}`);
          return;
        }

        renderAnswerStart();

        const result = await cell.ask(`
        請根據修改任務，重寫以下 Markdown 文件。

        請遵守：
        - 只輸出修改後的 Markdown 文件內容
        - 不要輸出說明
        - 不要包在 \`\`\`markdown code fence 裡
        - 不要新增目前系統尚未實作的能力

        # 修改任務

        ${task}

        ---

        # 原始文件

        ${originalContent}
        `);

        const outputText = engine.cleanMarkdownFence(result?.text ?? result?.answer ?? "");

        await cell.writeWorkspaceFile(fileName, outputText);

        console.log(`\nWorkspace file revised: ${fileName}`);
      },
    },

    {
      name: "/share",
      match: (input, { engine }) => input.startsWith("/share ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = commandArgs(input, "/share").split(/\s+/);

        if (args.length < 2) {
          console.log("Usage: /share <workspace-file> <target-cell-id>");
          return;
        }

        const [fileName, targetCellId] = args;
        const targetCell = engine.cells.get(targetCellId);

        if (!targetCell) {
          console.log(`Target cell not found: ${targetCellId}`);
          return;
        }

        try {
          const content = await cell.readWorkspaceFile(fileName);
          await targetCell.writeWorkspaceFile(fileName, content);

          console.log(`Shared ${fileName} from ${cell.id} to ${targetCellId}`);
        } catch {
          console.log(`Workspace file not found: ${fileName}`);
        }
      },
    },

    {
      name: "/import",
      match: (input, { engine }) => input.startsWith("/import ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = commandArgs(input, "/import").split(/\s+/);

        if (args.length < 2) {
          console.log("Usage: /import <source-cell-id> <workspace-file>");
          return;
        }

        const [sourceCellId, fileName] = args;
        const sourceCell = engine.cells.get(sourceCellId);

        if (!sourceCell) {
          console.log(`Source cell not found: ${sourceCellId}`);
          return;
        }

        try {
          const content = await sourceCell.readWorkspaceFile(fileName);
          await cell.writeWorkspaceFile(fileName, content);

          console.log(`Imported ${fileName} from ${sourceCellId} to ${cell.id}`);
        } catch {
          console.log(`Workspace file not found in ${sourceCellId}: ${fileName}`);
        }
      },
    },

    {
      name: "/project-init",
      match: (input, { engine }) =>
        input.startsWith("/project-init ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const projectName = commandArgs(input, "/project-init");

        if (!projectName) {
          console.log("Usage: /project-init <project-name>");
          return;
        }

        await cell.writeWorkspaceFile(
          `projects/${projectName}/README.md`,
          createProjectReadmeDocument({
            projectName,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Project initialized: projects/${projectName}`);
      },
    },

    {
      name: "/project-file",
      match: (input, { engine }) =>
        input.startsWith("/project-file ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const { first: projectName, rest: filePath } =
          splitFirstArg(input, "/project-file");

        if (!projectName || !filePath) {
          console.log("Usage: /project-file <project-name> <relative-file-path>");
          return;
        }

        await cell.writeWorkspaceFile(
          `projects/${projectName}/${filePath}`,
          createProjectFileDocument({
            cellId: cell.id,
            createdAt: new Date().toISOString(),
          })
        );

        console.log(`Project file created: projects/${projectName}/${filePath}`);
      },
    },

    {
      name: "/workspace",
      match: (input, { engine }) =>
        input === "/workspace" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const sections = await cell.listWorkspaceSections();

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
      },
    },

    {
      name: "/snapshot",
      match: (input, { engine }) => input === "/snapshot" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        const snapshot = await engine.getActiveCell().createSnapshot();
        console.log(`Snapshot created: ${snapshot}`);
      },
    },

    {
      name: "/snapshots",
      match: (input, { engine }) => input === "/snapshots" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        const snapshots = await engine.getActiveCell().listSnapshots();
        console.log(snapshots.length ? snapshots.join("\n") : "(no snapshots)");
      },
    },

    {
      name: "/restore",
      match: (input, { engine }) => input.startsWith("/restore ") && !engine.isCradleMode(),
      execute: async ({ engine, input }) => {
        const snapshotName = commandArgs(input, "/restore");

        if (!snapshotName) {
          console.log("Usage: /restore <snapshot-name>");
          return;
        }

        await engine.getActiveCell().restoreSnapshot(snapshotName);
        console.log(`Snapshot restored: ${snapshotName}`);
      },
    },

    {
      name: "/evolve",

      match: (input, { engine }) =>
        input === "/evolve" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        console.log("🧬 Evolving from thoughts...");

        const result = await cell.evolve({
          force: true,
        });

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
      },
    },

    {
      name: "/evolution",

      match: (input, { engine }) =>
        input === "/evolution" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {

        const cell =
          engine.getActiveCell();

        const content =
          await cell.readLatestEvolution();

        console.log(
          content ??
          "No evolution found."
        );
      },
    },

    {
      name: "/evolutions",

      match: (input, { engine }) =>
        input === "/evolutions" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {

        const cell =
          engine.getActiveCell();

        const files =
          await fs.readdir(
            cell.evolutionsDir
          );

        console.log("");

        files
          .filter(file => file.endsWith(".md"))
          .sort()
          .forEach(file => console.log(file));

        console.log("");
      },
    },

    {
      name: "/divide",

      match: (input, { engine }) =>
        (
          input === "/divide" ||
          input.startsWith("/divide ")
        ) &&
        !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        // 引入 CellDivisionService
        const { CellDivisionService } = await import("../lifecycle/cell-division-service.js");

        const parent = engine.getActiveCell();

        const args = input.trim().split(/\s+/);

        if (args.length > 2) {
          console.log("Usage: /divide [child-cell-id]");
          return;
        }

        const rawChildId = args[1] ?? "";

        const childId =
          rawChildId ||
          `cell-${String(engine.cells.size + 1).padStart(3, "0")}`;

        if (engine.hasCell(childId)) {
          console.log(`Cell already exists: ${childId}`);
          return;
        }


        const maturity = await parent.getMaturityInfo();

        const decision = await parent.getLifecycleDecision();

        renderDivisionReadiness({
          parent,
          childId,
          maturity,
          decision,
        });


        // 使用 CellDivisionService 執行完整的 Division 流程
        const service = new CellDivisionService();

        console.log(`🧬 Starting Living Context Division...`);
        console.log(``);

        let result;
        try {
          result = await service.divide({
            engine,
            parentCell: parent,
            childId
          });
        } catch (error) {
          console.error(`❌ Division failed:`, error.message);
          return;
        }

        if (!result.child) {
          renderDivisionBeforeChildFailure(result);
          return;
        }

        renderDivisionResult({
          parent,
          result,
        });

        console.log(`Parent: ${parent.id}`);
        console.log(`Child: ${childId}`);


        if (result.complete) {
          engine.activeCellId = result.child.id;
          console.log(`Switched to ${result.child.id}`);
        }
      },
    },


    {
      name: "/resp",

      match: (input,{engine}) =>
        input.startsWith("/resp ") &&
        !engine.isCradleMode(),

      execute: async ({engine,input}) => {

        const cell =
          engine.getActiveCell();

        const args =
          commandArgs(input, "/resp")
            .split(/\s+/);

        const action = args[0];

        if (action === "add") {
          const name = args[1];

          if (!name) {
            console.log("Usage: /resp add <name>");
            return;
          }

          await cell.addResponsibility(name);
          console.log(`Responsibility added: ${name}`);
          return;
        }

        if(action === "list") {

          const items =
            await cell.listResponsibilities();

          console.log(
            items.join("\n")
          );

          return;
        }

        console.log("Usage: /resp add <name> | /resp list");
      }
    },


    {
      name: "/link",

      match: (input,{engine}) =>
        input.startsWith("/link ") &&
        !engine.isCradleMode(),

      execute: async ({engine,input}) => {

        const cell =
          engine.getActiveCell();

        const args =
          commandArgs(input, "/link")
            .split(/\s+/);

        if(args.length < 2) {

          console.log(
            "Usage: /link depends-on cell-002"
          );

          return;
        }

        const type = args[0];
        const target = args[1];

        await cell.addRelationship(
          type,
          target
        );

        console.log(
          `${type} -> ${target}`
        );
      }
    },

    {
      name: "/profile",

      match: (input, { engine }) =>
        input === "/profile" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const profile = await cell.getProfile();
        const convergence = await cell.calculateConvergence();

        console.log(JSON.stringify({
          ...profile,
          convergence,
        }, null, 2));
      },
    },

    {
      name: "/digest",

      match: (input, { engine }) =>
        input === "/digest" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const inbox = engine.inboxes.get(cell.id) ?? [];

        if (inbox.length === 0) {
          console.log("(empty inbox)");
          return;
        }

        renderAnswerStart();

        const result = await cell.ask(`
        請整理以下 inbox 訊息，輸出成 Markdown。

        請包含：
        - 重點摘要
        - 可能任務
        - 需要回應的對象
        - 下一步建議

        # Inbox

        ${JSON.stringify(inbox, null, 2)}
        `);

        const outputText =
          engine.cleanMarkdownFence(result?.text ?? result?.answer ?? "");

        await cell.writeWorkspaceFile(
          `digest-${engine.formatTimestamp(new Date())}.md`,
          outputText
        );

        console.log("\nInbox digest created.");
      },
    },

    {
      name: "/process",

      match: (input, { engine }) =>
        input === "/process" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const inbox = engine.inboxes.get(cell.id) ?? [];

        if (inbox.length === 0) {
          console.log("(empty inbox)");
          return;
        }

        renderAnswerStart();

        const result = await cell.processInbox(inbox);

        engine.inboxes.set(cell.id, []);
        await cell.clearInbox();

        console.log(`
        Inbox processed.

        Messages:
        ${result.processed}

        ${result.summary}
        `);
      },
    },

    {
      name: "/clean-inbox",

      match: (input, { engine }) =>
        input === "/clean-inbox" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        engine.inboxes.set(cell.id, []);
        await cell.clearInbox();

        console.log(`Inbox cleared: ${cell.id}`);
      },
    },

    {
      name: "/specialize",

      match: (input, { engine }) =>
        input.startsWith("/specialize ") &&
        !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const role = commandArgs(input, "/specialize");

        if (!role) {
          console.log("Usage: /specialize <responsibility>");
          return;
        }

        await cell.addResponsibility(role);

        await cell.appendKnowledge(
          block([
            "## Specialization",
            "",
            "This cell has started specializing in:",
            "",
            role,
            "",
          ])
        );

        console.log(`Cell specialized: ${role}`);
      },
    },

    {
      name: "/tasks",
      match: (input, { engine }) =>
        input === "/tasks" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const tasks = await cell.readTasks();

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

        const result = await cell.ask(`
        請根據以下 Task 產出一份 Markdown 工作成果。

        請只輸出 Markdown，不要額外解釋。

        # Task

        ${JSON.stringify(task, null, 2)}
        `);

        const outputText =
          engine.cleanMarkdownFence(result?.text ?? result?.answer ?? "");

        const filename = `artifacts/${task.id}.md`;

        await cell.writeWorkspaceFile(filename, outputText);
        await cell.completeTask(task.id);

        console.log(`\nArtifact created: ${filename}`);
      },
    },

    {
      name: "/graph",

      match: (input,{engine}) =>
        input === "/graph" &&
        !engine.isCradleMode(),

      execute: async ({engine}) => {

        const cell =
          engine.getActiveCell();

        const resp =
          await cell.listResponsibilities();

        const links =
          await cell.listRelationships();

        console.log("");

        console.log(cell.id);

        console.log("");
        console.log("Responsibilities");

        for(const item of resp) {
          console.log(
            ` ├─ ${item}`
          );
        }

        console.log("");
        console.log("Relationships");

        for(const link of links) {
          console.log(
            ` ├─ ${link.type} -> ${link.target}`
          );
        }

        console.log("");
      }
    },

    {
      name: "/delegate",

      match: (input, { engine }) =>
        input.startsWith("/delegate ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const { first: targetCellId, rest: task } =
          splitFirstArg(input, "/delegate");

        if (!targetCellId || !task) {
          console.log("Usage: /delegate <cell-id> <task>");
          return;
        }

        if (!engine.cells.has(targetCellId)) {
          console.log(`Target cell not found: ${targetCellId}`);
          return;
        }

        await engine.pushMessage({
          from: cell.id,
          to: targetCellId,
          type: "delegation",
          content: task,
        });

        await cell.addRelationship("delegated-to", targetCellId);

        await cell.writeWorkspaceFile(
          `decisions/delegation-${engine.formatTimestamp(new Date())}.md`,
          `# Delegation

          ## From

          ${cell.id}

          ## To

          ${targetCellId}

          ## Task

          ${task}

          ---
          createdAt: ${new Date().toISOString()}
          `
        );

        console.log(`Delegated task from ${cell.id} to ${targetCellId}`);
      },
    },

    {
      name: "/report",

      match: (input, { engine }) =>
        input.startsWith("/report ") && !engine.isCradleMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const { first: targetCellId, rest: fileName } =
          splitFirstArg(input, "/report");

        if (!targetCellId || !fileName) {
          console.log("Usage: /report <cell-id> <workspace-file>");
          return;
        }

        const targetCell = engine.cells.get(targetCellId);

        if (!targetCell) {
          console.log(`Target cell not found: ${targetCellId}`);
          return;
        }

        let content = "";

        try {
          content = await cell.readWorkspaceFile(fileName);
        } catch {
          console.log(`Workspace file not found: ${fileName}`);
          return;
        }

        await engine.pushMessage({
          from: cell.id,
          to: targetCellId,
          type: "report",
          content: `
          # Report from ${cell.id}

          ## Source File

          ${fileName}

          ## Content

          ${content}
          `,
        });

        await cell.addRelationship("reported-to", targetCellId);

        console.log(`Report sent from ${cell.id} to ${targetCellId}`);
      },
    },

    {
      name: "/trace",

      match: (input, { engine }) =>
        input === "/trace" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        const profile = await cell.getProfile();
        const relationships = profile.relationships ?? [];

        console.log("");
        console.log(`Trace: ${cell.id}`);
        console.log("");

        if (relationships.length === 0) {
          console.log("(no relationships)");
          return;
        }

        for (const link of relationships) {
          console.log(`${cell.id} --${link.type}--> ${link.target}`);
        }

        console.log("");
      },
    },

  ];
}
