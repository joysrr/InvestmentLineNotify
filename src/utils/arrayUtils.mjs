export function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}