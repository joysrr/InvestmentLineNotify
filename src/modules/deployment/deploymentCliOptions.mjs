import { resolve } from "path";

export function parseDeploymentArgs(
  args,
  { projectRoot = process.cwd(), env = process.env } = {},
) {
  const options = {
    deployPath: env.DEPLOY_PATH || projectRoot,
    webappPath: env.WEBAPP_PATH || resolve(projectRoot, "webapp"),
    pm2Ecosystem: env.PM2_ECOSYSTEM || "ecosystem.config.cjs",
    rollback: false,
    rollbackTarget: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--rollback" || argument === "-r") {
      options.rollback = true;
    } else if (argument === "--tag" || argument === "-t") {
      options.rollbackTarget = args[++index];
    } else if (argument === "--deploy-path") {
      options.deployPath = args[++index];
    } else if (argument === "--webapp-path") {
      options.webappPath = args[++index];
    } else if (argument === "--pm2-ecosystem") {
      options.pm2Ecosystem = args[++index];
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown deployment option: ${argument}`);
    }
  }

  return options;
}

export function deploymentHelp() {
  return `
Usage: npm run deploy:production -- [options]

Options:
  --deploy-path PATH       Production project root
  --webapp-path PATH       Frontend project directory
  --pm2-ecosystem FILE     PM2 ecosystem config filename
  --rollback, -r           Roll back to the latest deployment tag
  --tag, -t TAG            Roll back to a specific deployment tag
  --help, -h               Show this help

This command deploys code only. It never copies production data or logs.
`;
}
