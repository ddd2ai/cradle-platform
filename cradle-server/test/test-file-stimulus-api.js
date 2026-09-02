import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createApiHandler } from "../src/api/api-handler.js";
import { createHttpServer } from "../src/api/http-server.js";
import { LogBuffer } from "../src/application/log-buffer.js";

let useCaseInput = null;
const apiHandler = createApiHandler({
  engine: {
    projectRoot: "/tmp/cradle-file-api-test",
    syncCellsFromDisk: async () => {},
  },
  ingestFileStimulusUseCase: {
    async execute(input) {
      useCaseInput = input;
      return {
        operationId: "op-file-1",
        type: "stimulus-cultivation",
        status: "accepted",
        progress: 0,
        currentStage: "accepted",
      };
    },
  },
});

const direct = await apiHandler({
  method: "POST",
  url: "/api/v1/stimuli/files?cellId=cell-a",
  headers: {
    "content-type": "text/plain",
    "x-cradle-file-name": "quality%20notes.txt",
  },
  body: Buffer.from("bounded evidence"),
});
assert.equal(direct.status, 202);
assert.equal(useCaseInput.fileName, "quality notes.txt");
assert.equal(useCaseInput.cellId, "cell-a");
assert.equal(useCaseInput.bytes.toString("utf8"), "bounded evidence");

let observedBody = null;
const server = createHttpServer({
  handler: async (request) => {
    observedBody = request.body;
    return {
      status: 202,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: { status: "accepted" },
    };
  },
});
const raw = await dispatch(server, {
  headers: { "content-type": "text/plain" },
  chunks: [Buffer.from("raw stimulus bytes")],
});
assert.equal(raw.status, 202);
assert.equal(Buffer.isBuffer(observedBody), true);
assert.equal(observedBody.toString("utf8"), "raw stimulus bytes");

const jsonFile = await dispatch(server, {
  headers: { "content-type": "application/json" },
  chunks: [Buffer.from('{"kind":"stimulus"}')],
});
assert.equal(jsonFile.status, 202);
assert.equal(Buffer.isBuffer(observedBody), true);
assert.equal(observedBody.toString("utf8"), '{"kind":"stimulus"}');

const megabyte = Buffer.alloc(1024 * 1024);
const tooLarge = await dispatch(server, {
  headers: { "content-type": "application/octet-stream" },
  chunks: [...Array.from({ length: 21 }, () => megabyte), Buffer.from([0])],
});
assert.equal(tooLarge.status, 413);
assert.equal(JSON.parse(tooLarge.body).error.code, "REQUEST_BODY_TOO_LARGE");

const activityLogs = new LogBuffer();
const activityHandler = createApiHandler({
  engine: {
    projectRoot: "/tmp/cradle-file-api-activity-test",
    syncCellsFromDisk: async () => {},
    getCell: (id) => id === "cell-a" ? { id } : null,
  },
  logBuffer: activityLogs,
  sourceDocumentStore: {
    accept: async () => ({
      sourceId: "source-activity",
      originalName: "activity.txt",
      mediaType: "text/plain",
      byteLength: 8,
      sha256: "activity-hash",
    }),
    recordStimulus: async () => {},
    readBytes: async () => Buffer.from("activity"),
    recordExtraction: async () => {},
  },
  documentExtractorRegistry: {
    extract: async () => ({
      status: "extracted",
      method: "test-text-v1",
      text: "activity",
      evidence: { outcome: "sufficient" },
    }),
  },
  stimulusCultivationService: {
    cultivate: async () => ({ lifeState: "stable", currentStage: "stable" }),
  },
});
const activityResponse = await activityHandler({
  method: "POST",
  url: "/api/v1/stimuli/files?cellId=cell-a",
  headers: {
    "content-type": "text/plain",
    "x-cradle-file-name": "activity.txt",
  },
  body: Buffer.from("activity"),
});
assert.equal(activityResponse.status, 202);
await new Promise((resolve) => setTimeout(resolve, 0));
const activityMessages = activityLogs.list().map((entry) => entry.message);
assert.equal(activityMessages.some((message) => message.includes("[stimulus] source.accepted")), true);
assert.equal(activityMessages.some((message) => message.includes("[stimulus] operation.accepted")), true);
assert.equal(activityMessages.some((message) => message.includes("[stimulus] extraction.completed")), true);

function dispatch(target, { headers, chunks }) {
  return new Promise((resolve) => {
    const request = new EventEmitter();
    request.method = "POST";
    request.url = "/api/v1/stimuli/files";
    request.headers = headers;
    const responseChunks = [];
    const response = {
      status: null,
      headers: null,
      writeHead(status, responseHeaders) {
        this.status = status;
        this.headers = responseHeaders;
      },
      end(chunk) {
        if (chunk) responseChunks.push(Buffer.from(chunk));
        resolve({
          status: this.status,
          headers: this.headers,
          body: Buffer.concat(responseChunks).toString("utf8"),
        });
      },
    };
    target.emit("request", request, response);
    for (const chunk of chunks) request.emit("data", chunk);
    request.emit("end");
  });
}

console.log("File stimulus API tests passed");
