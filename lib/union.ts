export function unionWithoutDuplicates<T>(a: T[], b: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of a) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  for (const item of b) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}
