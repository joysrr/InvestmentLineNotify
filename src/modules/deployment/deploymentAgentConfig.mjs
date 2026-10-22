import { resolve } from "path";

export function createDeploymentAgentConfig(env = process.env) {
  const deployPath = env.DEPLOY_PATH || "/home/ubuntu/investnotify";

  return {
    socketPath:
      env.INVESTNOTIFY_AGENT_SOCKET || "/run/investnotify/deploy-agent.sock",
    deployPath,
    webappPath: env.WEBAPP_PATH || resolve(deployPath, "webapp"),
    pm2Ecosystem: env.PM2_ECOSYSTEM || "ecosystem.config.cjs",
    dataDir: env.PRODUCTION_DATA_DIR || resolve(deployPath, "data"),
    logsDir: env.PRODUCTION_LOGS_DIR || resolve(deployPath, "logs"),
    diagnosticsDir:
      env.DIAGNOSTICS_DIR || "/home/ubuntu/investnotify-diagnostics",
  };
}
