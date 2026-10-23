function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid ${label} response`);
  }
}

export function parseHealthResponse(response) {
  const payload = parseJson(response, "health");
  return {
    ok: payload.status === "ok",
    status: payload.status ?? "unknown",
    ...(payload.ts === undefined ? {} : { ts: payload.ts }),
  };
}

export function parsePm2Status(response, expectedCwd, expectedProcesses) {
  const entries = parseJson(response, "PM2");
  const processes = entries.map((entry) => ({
    name: entry.name,
    status: entry.pm2_env?.status ?? "unknown",
    cwd: entry.pm_cwd ?? entry.pm2_env?.pm_cwd ?? null,
  }));
  const required = new Set(expectedProcesses);
  const ok =
    processes.length === required.size &&
    processes.every(
      (process) =>
        required.has(process.name) &&
        process.status === "online" &&
        process.cwd === expectedCwd,
    );

  return { ok, processes };
}

export function buildDeploymentVerification({
  commit,
  pm2,
  health,
  expectedCwd,
  expectedProcesses,
}) {
  const healthResult = parseHealthResponse(health);
  const pm2Result = parsePm2Status(pm2, expectedCwd, expectedProcesses);
  return {
    commit,
    health: healthResult,
    pm2: pm2Result,
    ok: healthResult.ok && pm2Result.ok && Boolean(commit),
  };
}
