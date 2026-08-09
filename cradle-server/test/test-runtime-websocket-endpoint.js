import assert from "node:assert/strict";
import WebSocket from "ws";
import { createHttpServer } from "../src/api/http-server.js";
import { attachRuntimeWebSocketEndpoint } from "../src/api/runtime-websocket-endpoint.js";
import { RuntimeEventAggregator } from "../src/application/runtime-event-aggregator.js";
import { RuntimeEventBus } from "../src/application/runtime-event-bus.js";
import { WebSocketRuntimeEventTransport } from "../src/application/runtime/websocket-runtime-event-transport.js";

const transport = new WebSocketRuntimeEventTransport({ heartbeatIntervalMs: 0 });
const aggregator = new RuntimeEventAggregator({
  eventBus: new RuntimeEventBus(),
  transports: [transport],
});
aggregator.start();

const server = createHttpServer({
  handler: async () => ({
    status: 404,
    headers: { "content-type": "application/json" },
    body: { error: "not found" },
  }),
});
const endpoint = attachRuntimeWebSocketEndpoint({ server, transport });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const client = new WebSocket(`ws://127.0.0.1:${port}/api/v1/runtime/events`);
await new Promise((resolve, reject) => {
  client.once("open", resolve);
  client.once("error", reject);
});

const received = new Promise((resolve) => client.once("message", (data) => resolve(data.toString())));
const event = aggregator.publish("cell.updated", { cellId: "cell-001" });
assert.deepEqual(JSON.parse(await received), event);

client.close();
await new Promise((resolve) => client.once("close", resolve));
aggregator.stop();
endpoint.stop();
await new Promise((resolve) => server.close(resolve));

console.log("Runtime WebSocket endpoint tests passed");
