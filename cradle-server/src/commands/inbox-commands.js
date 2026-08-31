import { renderAnswerStart } from "../cradle-console.js";
import { splitFirstArg } from "./command-input.js";
import { createInboxDigestPrompt } from "./cell-command-prompts.js";
import {
  renderInbox,
  renderInboxProcessResult,
} from "./cell-work-renderer.js";

export function createInboxCommands() {
  return [
    {
      name: "/inbox",
      match: (input, { engine }) => input === "/inbox" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const inbox = await cell.readInbox();
        engine.inboxes.set(cell.id, inbox);

        renderInbox(inbox);
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
      name: "/digest",

      match: (input, { engine }) =>
        input === "/digest" &&
        !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const inbox = await cell.readInbox();
        engine.inboxes.set(cell.id, inbox);

        if (inbox.length === 0) {
          console.log("(empty inbox)");
          return;
        }

        renderAnswerStart();

        const result = await cell.ask(createInboxDigestPrompt(inbox));

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
        const claim = cell.claimInbox
          ? await cell.claimInbox()
          : { claimId: null, messages: await cell.readInbox() };
        const inbox = claim.messages;

        if (inbox.length === 0) {
          console.log("(empty inbox)");
          return;
        }

        renderAnswerStart();

        let result;
        try {
          result = await cell.processInbox(inbox);
          if (cell.acknowledgeInboxClaim) {
            await cell.acknowledgeInboxClaim(claim.claimId);
            engine.inboxes.set(cell.id, await cell.readInbox());
          } else {
            await cell.clearInbox();
            engine.inboxes.set(cell.id, []);
          }
        } catch (error) {
          await cell.releaseInboxClaim?.(claim.claimId);
          throw error;
        }

        renderInboxProcessResult(result);
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
  ];
}
