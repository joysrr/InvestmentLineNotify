import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/vm-daily-check.sh");

describe("vm-daily-check wrapper contract", () => {
  it("uses an atomic lock directory and records the owner PID", async () => {
    const script = await readFile(scriptPath, "utf8");

    expect(script).toMatch(/LOCK_DIR=/);
    expect(script).toMatch(/mkdir\s+.*LOCK_DIR/);
    expect(script).toMatch(/LOCK_DIR\/pid/);
    expect(script).toMatch(/\$\$/);
  });

  it("supports configurable repository and lock paths", async () => {
    const script = await readFile(scriptPath, "utf8");

    expect(script).toMatch(/REPO_DIR=.*\$\{REPO_DIR:-/);
    expect(script).toMatch(/LOCK_DIR=.*\$\{LOCK_DIR:-/);
  });

  it("wraps the daily runner with a bounded timeout and ipv4-first dns order", async () => {
    const script = await readFile(scriptPath, "utf8");

    expect(script).toMatch(/timeout[\s\S]*node\s+.*--env-file/);
    expect(script).toMatch(/--dns-result-order=ipv4first/);
    expect(script).toMatch(/TIMEOUT_SECONDS/);
  });
});
