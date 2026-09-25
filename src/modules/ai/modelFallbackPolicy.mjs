export function getNextModelIndex({
  currentModelIndex,
  modelCount,
  errorType,
}) {
  if (modelCount <= 0 || !["service", "quota"].includes(errorType)) {
    return currentModelIndex;
  }

  return (currentModelIndex + 1) % modelCount;
}
