import { describe, expect, it, vi } from "vitest";
import { createDeploymentAgentClient } from "./deploymentAgentClient.mjs";

describe("createDeploymentAgentClient", () => {
  it("submits a fixed deploy request through the injected transport", async () => {
    const request = vi.fn().mockResolvedValue({
      statusCode: 202,
      body: { jobId: "job-1", status: "queued" },
    });
    const client = createDeploymentAgentClient({ request });

    const result = await client.createDeployJob({ rollback: false });

    expect(result).toEqual({ jobId: "job-1", status: "queued" });
    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/deploy-production",
      body: { rollback: false },
    });
  });

  it("queries a deployment job without accepting command options", async () => {
    const request = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: { jobId: "job-1", status: "skipped" },
    });
    const client = createDeploymentAgentClient({ request });

    const result = await client.getJobState("job-1");

    expect(result).toEqual({ jobId: "job-1", status: "skipped" });
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/deployments/job-1",
    });
  });
});
