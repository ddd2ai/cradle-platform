import assert from "node:assert/strict";
import { createColonyCommands } from "../src/commands/colony-commands.js";

const parents = [
  { id: "cell-a" },
  { id: "cell-b" },
];

const child = {
  id: "cell-fused",
  readLivingContext: async () => ({ purpose: "test fusion" }),
  readCellProfile: async () => ({ role: "fused-test-cell" }),
};

const fuseCalls = [];
const fusionService = {
  fuse: async (request) => {
    fuseCalls.push(request);
    return {
      success: true,
      complete: true,
      child,
      fusionPlan: {
        capabilityResolutions: [],
        knowledgeConflicts: [],
        productionPlan: [],
      },
      productionResult: {
        produced: [],
        failed: [],
      },
    };
  },
};

const engine = {
  activeCellId: "Cradle",
  cells: new Map(parents.map((cell) => [cell.id, cell])),
};

assert.equal(
  typeof engine.listCells,
  "undefined",
  "CLI should inject the real CradleEngine shape without a listCells dependency",
);

const commands = createColonyCommands({
  fusionServiceFactory: () => fusionService,
});
const fuseCommand = commands.find((command) => command.name === "/fuse");
const mergeAlias = commands.find((command) => command.name === "/merge");

assert.ok(fuseCommand, "/fuse command should be registered");
assert.ok(mergeAlias, "/merge alias should be registered");
assert.equal(fuseCommand.match("/fuse cell-a cell-b cell-fused"), true);
assert.equal(mergeAlias.match("/merge cell-a cell-b cell-fused"), true);

const output = [];
const originalLog = console.log;
console.log = (...args) => output.push(args.join(" "));

try {
  await fuseCommand.execute({
    engine,
    input: "/fuse cell-a cell-b cell-fused",
  });

  assert.equal(fuseCalls.length, 1, "/fuse should invoke fusion once");
  assert.equal(engine.activeCellId, "cell-fused");
  assert.equal(
    output.includes("/merge is deprecated. Use /fuse instead."),
    false,
    "/fuse should not print a deprecation warning",
  );

  output.length = 0;
  engine.activeCellId = "Cradle";

  await mergeAlias.execute({
    engine,
    input: "/merge cell-a cell-b cell-fused",
  });

  assert.equal(fuseCalls.length, 2, "/merge should invoke fusion once");
  assert.equal(engine.activeCellId, "cell-fused");
  assert.ok(
    output.includes("/merge is deprecated. Use /fuse instead."),
    "/merge should print the deprecation warning",
  );

  const [fuseRequest, mergeRequest] = fuseCalls;
  assert.equal(fuseRequest.engine, mergeRequest.engine);
  assert.equal(fuseRequest.engine, engine);
  assert.deepEqual(fuseRequest.parentCells, mergeRequest.parentCells);
  assert.equal(fuseRequest.childId, mergeRequest.childId);
} finally {
  console.log = originalLog;
}

console.log("✅ /fuse and deprecated /merge alias share the fusion command flow");
