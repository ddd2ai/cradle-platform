import http from "http";

export function createHttpServer({ handler }) {
  return http.createServer(async (request, response) => {
    const result = await handler({
      method: request.method,
      url: request.url,
      body: await readRequestBody(request),
    });

    response.writeHead(result.status, result.headers);
    response.end(JSON.stringify(result.body));
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");

      if (!text) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(text);
      }
    });
  });
}
