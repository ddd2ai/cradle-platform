import { renderAnswerStart } from "../merlin-ui.js";

export function createCellCommands() {
  return [
    {
      name: "/inbox",
      match: (input, { engine }) => input === "/inbox" && !engine.isMerlinMode(),
      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const inbox = engine.inboxes.get(cell.id) ?? [];

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

        engine.pushMessage({
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

        const filename = `note-${engine.formatTimestamp(new Date())}.md`;

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
      name: "/workspace",
      match: (input, { engine }) => input === "/workspace" && !engine.isMerlinMode(),
      execute: async ({ engine }) => {
        const files = await engine.getActiveCell().listWorkspace();
        console.log(files.length ? files.join("\n") : "(empty workspace)");
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
    🧬 ${cell.id} evolved

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

        const parentInfo =
          await parent.getEvolutionInfo();

        await child.setParent(
          parent.id
        );

        await child.setGeneration(
          parentInfo.generation + 1
        );

        console.log(`
    🦞 Cell Division Complete

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