/**
 * Privileged deployment agent transport over a Unix domain socket.
 * Business operations are injected so transport tests cannot run real deployment.
 */

import { createServer } from "http";
import { unlink } from "fs/promises";
import { once } from "events";

const ROUTES = new Map([
  ["GET /status", "status"],
  ["POST /sync-production-artifacts", "sync"],
  ["POST /deploy-production", "deploy"],
]);

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

export function createDeploymentAgentServer({ socketPath, sync, deploy }) {
  if (
    !socketPath ||
    typeof sync !== "function" ||
    typeof deploy !== "function"
  ) {
    throw new Error("socketPath, sync and deploy handlers are required");
  }

  const server = createServer(async (request, response) => {
    const operation = ROUTES.get(`${request.method} ${request.url}`);
    if (!operation) {
      sendJson(response, 404, { error: "Not Found" });
      return;
    }

    try {
      if (operation === "status") {
        sendJson(response, 200, {
          service: "investnotify-deploy-agent",
          status: "ok",
        });
        return;
      }

      const payload = await readJsonBody(request);
      const result =
        operation === "sync" ? await sync(payload) : await deploy(payload);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
  });

  server.start = async () => {
    try {
      await unlink(socketPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    server.listen(socketPath);
    await once(server, "listening");
  };

  return server;
}

export { readJsonBody };
