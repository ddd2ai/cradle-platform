import http from "http";

const MAX_REQUEST_BODY_BYTES = 21 * 1024 * 1024;

export function createHttpServer({ handler }) {
  return http.createServer(async (request, response) => {
    let result;
    try {
      result = await handler({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: await readRequestBody(request),
      });
    } catch (error) {
      response.writeHead(error?.status ?? 500, {
        "content-type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify({
        error: {
          code: error?.code ?? "HTTP_REQUEST_FAILED",
          message: error?.message ?? "HTTP request failed",
        },
      }));
      return;
    }

    response.writeHead(result.status, result.headers);

    if (result.streamResponse === true) {
      response.flushHeaders?.();
      const disconnect = result.openResponse(response);
      request.on("close", () => {
        disconnect?.();
      });
      return;
    }

    response.end(
      Buffer.isBuffer(result.body) || typeof result.body === "string"
        ? result.body
        : JSON.stringify(result.body)
    );
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteLength = 0;
    let bodyError = null;

    request.on("data", (chunk) => {
      if (bodyError) return;
      byteLength += chunk.length;
      if (byteLength > MAX_REQUEST_BODY_BYTES) {
        const error = new Error(`Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes`);
        error.status = 413;
        error.code = "REQUEST_BODY_TOO_LARGE";
        bodyError = error;
        return;
      }
      chunks.push(chunk);
    });
    request.on("error", reject);
    request.on("end", () => {
      if (bodyError) {
        reject(bodyError);
        return;
      }
      const body = Buffer.concat(chunks);
      const contentType = String(request.headers["content-type"] ?? "").toLowerCase();

      if (body.length === 0) {
        resolve(null);
        return;
      }

      if (
        !contentType.includes("application/json") ||
        String(request.url ?? "").split("?", 1)[0] === "/api/v1/stimuli/files"
      ) {
        resolve(body);
        return;
      }

      const text = body.toString("utf8");

      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(text);
      }
    });
  });
}
