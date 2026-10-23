export function buildVerificationCommands() {
  return {
    commit: ["git", ["rev-parse", "--short", "HEAD"]],
    pm2: ["pm2", ["jlist"]],
    health: [
      "curl",
      [
        "--fail",
        "--silent",
        "--show-error",
        "--max-time",
        "10",
        "--retry",
        "5",
        "--retry-delay",
        "2",
        "--retry-connrefused",
        "http://127.0.0.1:3000/health",
      ],
    ],
  };
}
