import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeploymentControl from "./DeploymentControl.vue";

const { apiFetch } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));
vi.mock("../../api/index.js", () => ({
  apiFetch,
}));

describe("DeploymentControl", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("shows the skipped result returned by the Agent", async () => {
    apiFetch
      .mockResolvedValueOnce({ jobId: "job-1", status: "queued" })
      .mockResolvedValueOnce({
        jobId: "job-1",
        status: "skipped",
        skipReason: "already-up-to-date",
        commit: "ef4ca31",
      });

    const wrapper = mount(DeploymentControl, {
      global: { stubs: { "el-button": true } },
    });

    await wrapper.get('[data-testid="deployment-start"]').trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="deployment-status"]').text()).toContain(
        "版本已是最新",
      ),
    );

    expect(apiFetch).toHaveBeenNthCalledWith(1, "/api/deploy", {
      method: "POST",
      body: JSON.stringify({ rollback: false }),
    });
  });

  it("shows an error when the API rejects the deployment", async () => {
    apiFetch.mockRejectedValueOnce(new Error("需要管理員權限"));

    const wrapper = mount(DeploymentControl, {
      global: { stubs: { "el-button": true } },
    });

    await wrapper.get('[data-testid="deployment-start"]').trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="deployment-status"]').text()).toContain(
        "需要管理員權限",
      ),
    );
  });
});
