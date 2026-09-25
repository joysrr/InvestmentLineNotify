export function shouldRetryWithoutThinkingConfig(error) {
  return String(error?.message ?? error ?? "").includes(
    "Thinking level is not supported for this model",
  );
}
