import { renderAnswerStart } from "../merlin-ui.js";

export function createCellCommands() {
  return [
    {
      name: "/inbox",
      match: (input, { engine }) => input === "/inbox" && !engine.isMerlinMode(),
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
      match: (input, { engine }) => input.startsWith("/send ") && !engine.isMerlinMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = input.replace("/send ", "").trim();
        const firstSpaceIndex = args.indexOf(" ");

        if (firstSpaceIndex === -1) {
          console.log("Usage: /send <cell-id> <message>");
          return;
        }

        const targetCellId = args.slice(0, firstSpaceIndex).trim();
        const message = args.slice(firstSpaceIndex + 1).trim();

        if (!engine.cells.has(targetCellId)) {
          console.log(`Target cell not found: ${targetCellId}`);
          return;
        }

        if (!message) {
          console.log("Usage: /send <cell-id> <message>");
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
      match: (input, { engine }) => input === "/memory" && !engine.isMerlinMode(),
      execute: async ({ engine }) => {
        console.log(await engine.getActiveCell().buildMemoryContext());
      },
    },

    {
      name: "/memory full",
      match: (input, { engine }) => input === "/memory full" && !engine.isMerlinMode(),
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
      match: (input, { engine }) => input === "/thoughts" && !engine.isMerlinMode(),
      execute: async ({ engine }) => {
        console.log(await engine.getActiveCell().readRecentThoughts(12000));
      },
    },

    {
      name: "/think",

      match: (input, { engine }) =>
        input === "/think" &&
        !engine.isMerlinMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        renderAnswerStart();

        const thought = await cell.think();

        console.log(`
    Thought created.

    ${thought}
    `);
      },
    },

    {
      name: "/feed",
      match: (input, { engine }) => input.startsWith("/feed ") && !engine.isMerlinMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = input.replace("/feed ", "").trim();

        if (!content) {
          console.log("Usage: /feed <content>");
          return;
        }

        await cell.appendKnowledge(`## ${new Date().toISOString()}\n\n${content}`);
        console.log("Memory updated.");
      },
    },

    {
      name: "/write",
      match: (input, { engine }) => input.startsWith("/write ") && !engine.isMerlinMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = input.replace("/write ", "").trim();

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
        input.startsWith("/write-note ") && !engine.isMerlinMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = input.replace("/write-note ", "").trim();

        if (!content) {
          console.log("Usage: /write-note <content>");
          return;
        }

        const filename = `notes/note-${engine.formatTimestamp(new Date())}.md`;

        await cell.writeWorkspaceFile(
          filename,
          `# Note

${content}

---
createdAt: ${new Date().toISOString()}
`
        );

        console.log(`Note created: ${filename}`);
      },
    },

    {
      name: "/decide",
      match: (input, { engine }) =>
        input.startsWith("/decide ") && !engine.isMerlinMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = input.replace("/decide ", "").trim();

        if (!content) {
          console.log("Usage: /decide <decision>");
          return;
        }

        const filename = `decisions/decision-${engine.formatTimestamp(new Date())}.md`;

        await cell.writeWorkspaceFile(
          filename,
          `# Decision

          ${content}

          ## Context

          TODO: describe why this decision was made.

          ## Consequences

          TODO: describe the trade-offs.

          ---
          createdAt: ${new Date().toISOString()}
          `
        );

        console.log(`Decision created: ${filename}`);
      },
    },

    {
      name: "/research",
      match: (input, { engine }) =>
        input.startsWith("/research ") && !engine.isMerlinMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const content = input.replace("/research ", "").trim();

        if (!content) {
          console.log("Usage: /research <content>");
          return;
        }

        const filename = `research/research-${engine.formatTimestamp(new Date())}.md`;

        await cell.writeWorkspaceFile(
          filename,
          `# Research

          ${content}

          ## Source

          manual

          ## Notes

          TODO: summarize key findings.

          ---
          createdAt: ${new Date().toISOString()}
          `
        );

        console.log(`Research created: ${filename}`);
      },
    },

    {
      name: "/read",
      match: (input, { engine }) => input.startsWith("/read ") && !engine.isMerlinMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const fileName = input.replace("/read ", "").trim();

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
      match: (input, { engine }) => input.startsWith("/revise ") && !engine.isMerlinMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = input.replace("/revise ", "").trim();
        const firstSpaceIndex = args.indexOf(" ");

        if (firstSpaceIndex === -1) {
          console.log("Usage: /revise <workspace-file> <task>");
          return;
        }

        const fileName = args.slice(0, firstSpaceIndex).trim();
        const task = args.slice(firstSpaceIndex + 1).trim();

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
      match: (input, { engine }) => input.startsWith("/share ") && !engine.isMerlinMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = input.replace("/share ", "").trim().split(/\s+/);

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
      match: (input, { engine }) => input.startsWith("/import ") && !engine.isMerlinMode(),
      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = input.replace("/import ", "").trim().split(/\s+/);

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
        input.startsWith("/project-init ") && !engine.isMerlinMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const projectName = input.replace("/project-init ", "").trim();

        if (!projectName) {
          console.log("Usage: /project-init <project-name>");
          return;
        }

        await cell.writeWorkspaceFile(
          `projects/${projectName}/README.md`,
          `# ${projectName}

          ## Purpose

          TODO: describe project purpose.

          ## Structure

          TODO: describe project structure.

          ---
          createdAt: ${new Date().toISOString()}
          `
        );

        console.log(`Project initialized: projects/${projectName}`);
      },
    },

    {
      name: "/project-file",
      match: (input, { engine }) =>
        input.startsWith("/project-file ") && !engine.isMerlinMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const args = input.replace("/project-file ", "").trim();
        const firstSpaceIndex = args.indexOf(" ");

        if (firstSpaceIndex === -1) {
          console.log("Usage: /project-file <project-name> <relative-file-path>");
          return;
        }

        const projectName = args.slice(0, firstSpaceIndex).trim();
        const filePath = args.slice(firstSpaceIndex + 1).trim();

        if (!projectName || !filePath) {
          console.log("Usage: /project-file <project-name> <relative-file-path>");
          return;
        }

        await cell.writeWorkspaceFile(
          `projects/${projectName}/${filePath}`,
          `// TODO: generated by ${cell.id}
           // createdAt: ${new Date().toISOString()}
          `
        );

        console.log(`Project file created: projects/${projectName}/${filePath}`);
      },
    },

    {
      name: "/workspace",
      match: (input, { engine }) =>
        input === "/workspace" && !engine.isMerlinMode(),

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
      match: (input, { engine }) => input === "/snapshot" && !engine.isMerlinMode(),
      execute: async ({ engine }) => {
        const snapshot = await engine.getActiveCell().createSnapshot();
        console.log(`Snapshot created: ${snapshot}`);
      },
    },

    {
      name: "/snapshots",
      match: (input, { engine }) => input === "/snapshots" && !engine.isMerlinMode(),
      execute: async ({ engine }) => {
        const snapshots = await engine.getActiveCell().listSnapshots();
        console.log(snapshots.length ? snapshots.join("\n") : "(no snapshots)");
      },
    },

    {
      name: "/restore",
      match: (input, { engine }) => input.startsWith("/restore ") && !engine.isMerlinMode(),
      execute: async ({ engine, input }) => {
        const snapshotName = input.replace("/restore ", "").trim();

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
        !engine.isMerlinMode(),

      execute: async ({ engine }) => {

        const cell =
          engine.getActiveCell();

        const result =
          await cell.mature();

        console.log(`
        🦠 ${cell.id} evolved

        Maturity:
        ${result.maturity}
        `);
      },
    },

    {
      name: "/divide",

      match: (input, { engine }) =>
        input === "/divide" &&
        !engine.isMerlinMode(),

      execute: async ({ engine }) => {

        const parent =
          engine.getActiveCell();

        if (!(await parent.canDivide())) {

          console.log(`
          Need maturity >= 5

          Current:
          ${await parent.getMaturity()}
          `);

          return;
        }

        const nextNumber =
          engine.cells.size + 1;

        const childId =
          `cell-${String(nextNumber)
            .padStart(3, "0")}`;

        const child =
          await engine.createCell(
            childId
          );

        await parent.divideTo(child);

        console.log(`
        🦠 Cell Division Complete

        Parent :
        ${parent.id}

        Child :
        ${childId}
        `);
      },
    },


    {
      name: "/resp",

      match: (input,{engine}) =>
        input.startsWith("/resp ") &&
        !engine.isMerlinMode(),

      execute: async ({engine,input}) => {

        const cell =
          engine.getActiveCell();

        const args =
          input.replace("/resp ","")
            .trim()
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
        !engine.isMerlinMode(),

      execute: async ({engine,input}) => {

        const cell =
          engine.getActiveCell();

        const args =
          input.replace("/link ","")
            .trim()
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
        !engine.isMerlinMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const profile = await cell.getProfile();

        console.log(JSON.stringify(profile, null, 2));
      },
    },

    {
      name: "/digest",

      match: (input, { engine }) =>
        input === "/digest" &&
        !engine.isMerlinMode(),

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
        !engine.isMerlinMode(),

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
        !engine.isMerlinMode(),

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
        !engine.isMerlinMode(),

      execute: async ({ engine, input }) => {
        const cell = engine.getActiveCell();
        const role = input.replace("/specialize ", "").trim();

        if (!role) {
          console.log("Usage: /specialize <responsibility>");
          return;
        }

        await cell.addResponsibility(role);

        await cell.appendKnowledge(`
        ## Specialization

        This cell has started specializing in:

        ${role}
        `);

        console.log(`Cell specialized: ${role}`);
      },
    },

    {
      name: "/tasks",
      match: (input, { engine }) =>
        input === "/tasks" && !engine.isMerlinMode(),

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
        input === "/do" && !engine.isMerlinMode(),

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
        !engine.isMerlinMode(),

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

  ];
}