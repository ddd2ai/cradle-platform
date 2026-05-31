import { MerlinEngine } from "./merlin-engine.js";
import { MerlinCell } from "./merlin-cell.js";

const MODEL = process.env.MODEL || "gpt-4.1";

const engine = new MerlinEngine();

engine.register(
  new MerlinCell({
    name: "Main Cell",
    model: MODEL,
  })
);

await engine.start();