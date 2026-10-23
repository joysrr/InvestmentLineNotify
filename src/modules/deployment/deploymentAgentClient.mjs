import { request as httpRequest } from "http";

function createUnixSocketRequest(socketPath) {
  return ({ method, path, body }) =>
    new Promise((resolve, reject) => {
      const request = httpRequest(
        {
          socketPath,
          path,
          method,
          headers: body
            ? {
                "content-type": "application/json",
              }
            : undefined,
        },
        (response) => {
          let payload = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            payload += chunk;
          });
          response.on("end", () => {
            let parsed;
            try {
              parsed = payload ? JSON.parse(payload) : null;
            } catch {
              reject(new Error("Deployment Agent returned invalid JSON"));
              return;
            }
            resolve({ statusCode: response.statusCode, body: parsed });
          });
        },
      );

      request.on("error", reject);
      if (body) request.write(JSON.stringify(body));
      request.end();
    });
}

function assertResponse(response) {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const message = response.body?.message || response.body?.error;
    throw new Error(message || `Deployment Agent HTTP ${response.statusCode}`);
  }
  return response.body;
}

export function createDeploymentAgentClient({
  request = createUnixSocketRequest(
    process.env.INVESTNOTIFY_AGENT_SOCKET ||
      "/run/investnotify/deploy-agent.sock",
  ),
} = {}) {
  return {
    async createDeployJob({ rollback = false } = {}) {
      return assertResponse(
        await request({
          method: "POST",
          path: "/deploy-production",
          body: { rollback },
        }),
      );
    },

    async getJobState(jobId) {
      if (!/^[a-zA-Z0-9-]+$/.test(jobId)) {
        throw new Error("Invalid deployment job ID");
      }
      return assertResponse(
        await request({
          method: "GET",
          path: `/deployments/${jobId}`,
        }),
      );
    },
  };
}
