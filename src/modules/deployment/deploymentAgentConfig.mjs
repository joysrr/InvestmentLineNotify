import { isAbsolute, relative, resolve } from "path";

const REQUIRED_KEYS = [
  "INVESTNOTIFY_AGENT_SOCKET",
  "DEPLOY_PATH",
  "WEBAPP_PATH",
  "PM2_ECOSYSTEM",
  "PRODUCTION_DATA_DIR",
  "PRODUCTION_LOGS_DIR",
  "DIAGNOSTICS_DIR",
];

export function createDeploymentAgentConfig(env = process.env) {
  const missing = REQUIRED_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required deployment agent configuration: ${missing.join(", ")}`,
    );
  }

  const deployPath = resolve(env.DEPLOY_PATH);
  const diagnosticsDir = resolve(env.DIAGNOSTICS_DIR);
  const checkoutRelativePath = relative(deployPath, diagnosticsDir);
  if (
    !isAbsolute(diagnosticsDir) ||
    checkoutRelativePath === "" ||
    (!checkoutRelativePath.startsWith("..") &&
      !isAbsolute(checkoutRelativePath))
  ) {
    throw new Error("DIAGNOSTICS_DIR must be outside DEPLOY_PATH");
  }

  return {
    socketPath: env.INVESTNOTIFY_AGENT_SOCKET,
    deployPath,
    webappPath: resolve(env.WEBAPP_PATH),
    pm2Ecosystem: env.PM2_ECOSYSTEM,
    dataDir: resolve(env.PRODUCTION_DATA_DIR),
    logsDir: resolve(env.PRODUCTION_LOGS_DIR),
    diagnosticsDir,
  };
}
