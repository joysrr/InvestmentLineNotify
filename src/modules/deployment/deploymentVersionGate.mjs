export function buildVersionCheckCommands() {
  return {
    local: ["git", ["rev-parse", "HEAD"]],
    remote: ["git", ["rev-parse", "origin/main"]],
  };
}

export function shouldSkipDeployment(localCommit, remoteCommit) {
  const commit = remoteCommit || localCommit;
  const skip = Boolean(
    localCommit && remoteCommit && localCommit === remoteCommit,
  );

  return {
    skip,
    reason: skip ? "already-up-to-date" : null,
    commit,
  };
}
