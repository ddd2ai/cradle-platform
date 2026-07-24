import { renderAnswerStart } from "../cradle-console.js";
import { renderFullMemory } from "./cell-memory-renderer.js";
import {
  renderDNAHistory,
  renderLifecycleDecision,
  renderMaturityInfo,
} from "./cell-status-renderer.js";

export function createCellIntrospectionCommands() {
  return [
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
        const cell = engine.getActiveCell();
        const history = await cell.readDNAHistory();

        renderDNAHistory(history);
      },
    },

    {
      name: "/maturity",
      match: (input, { engine }) =>
        input === "/maturity" && !engine.isCradleMode(),

      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();
        const maturity = await cell.getMaturityInfo();

        renderMaturityInfo(maturity);
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

        renderLifecycleDecision({
          cell,
          maturity,
          decision,
        });
      },
    },

    {
      name: "/memory full",
      match: (input, { engine }) => input === "/memory full" && !engine.isCradleMode(),
      execute: async ({ engine }) => {
        const cell = engine.getActiveCell();

        renderFullMemory({
          identity: await cell.safeReadMemory("identity"),
          rules: await cell.safeReadMemory("rules"),
          knowledge: await cell.safeReadMemory("knowledge"),
          history: await cell.safeReadMemory("history"),
        });
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
  ];
}
