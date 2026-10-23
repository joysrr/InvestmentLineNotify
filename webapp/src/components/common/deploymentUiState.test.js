import { describe, expect, it } from "vitest";
import {
  getDeploymentStatusText,
  isDeploymentFinished,
} from "./deploymentUiState.js";

describe("deployment UI state", () => {
  it("shows a distinct message when deployment is skipped", () => {
    expect(getDeploymentStatusText("skipped")).toBe("版本已是最新，略過部署");
  });

  it("treats skipped as a finished deployment state", () => {
    expect(isDeploymentFinished("skipped")).toBe(true);
    expect(isDeploymentFinished("running")).toBe(false);
  });
});
