import { WebSocketServer } from "ws";

export const RUNTIME_EVENTS_PATH = "/api/v1/runtime/events";

export function attachRuntimeWebSocketEndpoint({
  server,
  transport,
  path = RUNTIME_EVENTS_PATH,
}) {
  const websocketServer = new WebSocketServer({ noServer: true });

  const handleUpgrade = (request, socket, head) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname !== path) {
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (client) => {
      websocketServer.emit("connection", client, request);
    });
  };

  websocketServer.on("connection", (client) => {
    transport.addClient(client);
  });
  server.on("upgrade", handleUpgrade);

  return {
    websocketServer,
    stop() {
      server.off("upgrade", handleUpgrade);
      websocketServer.close();
    },
  };
}
