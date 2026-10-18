// Hash only the first two code points so conjugated candidates usually read the
// same term shard. Fixed 256 buckets cap file count and metadata overhead.
export function termBucket(term: string) {
  let hash = 2166136261;
  for (const char of [...term].slice(0, 2)) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return (hash & 255).toString(16).padStart(2, "0");
}

export function entryBucket(id: string) {
  return (Number(id) % 256).toString(16).padStart(2, "0");
}
