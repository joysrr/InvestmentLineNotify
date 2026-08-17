import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const run = (command, args, cwd = root) => {
  const started = Date.now();
  try {
    const output = execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      status: "passed",
      durationMs: Date.now() - started,
      output: output.slice(-4000),
    };
  } catch (error) {
    return {
      status: "failed",
      durationMs: Date.now() - started,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`.slice(-4000),
    };
  }
};

const git = (args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const baseline = {
  collectedAt: new Date().toISOString(),
  gitCommit: git(["rev-parse", "HEAD"]),
  branch: git(["branch", "--show-current"]),
  frontendTests: run("npx", ["vitest", "run"], join(root, "webapp")),
  backendTests: run("npx", ["vitest", "run", "src/api"], root),
  frontendLint: run("npx", ["eslint", "src"], join(root, "webapp")),
  backendLint: run("npx", ["eslint", "src"], root),
};

console.log(JSON.stringify(baseline, null, 2));
