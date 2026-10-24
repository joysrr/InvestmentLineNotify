import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "../..", "..");
const cliPath = resolve(projectRoot, "runMacroCompare.mjs");
const removedDependencyPath = resolve(
  projectRoot,
  "src/modules/backtest/backtestMacroSentimentCompare.mjs",
);

describe("runMacroCompare legacy entry", () => {
  it("documents the removed backtest dependency and fails explicitly", async () => {
    await expect(access(removedDependencyPath)).rejects.toMatchObject({
      code: "ENOENT",
    });

    await expect(
      execFileAsync(process.execPath, [cliPath, "--help"]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("ERR_MODULE_NOT_FOUND"),
    });
  });
});
