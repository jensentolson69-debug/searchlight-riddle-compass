/** Exact matching only: never reorder words or merge unrelated riddles. */
export function riddleKey(riddle: string): string {
  return riddle.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ").replace(/[?!.]+$/, "").trim();
}

export function cacheLifetime(riddle: string): number {
  return /\b(new|newest|latest|last|today|now|current|nerfed|update)\b/i.test(riddle) ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

/** A cache miss (or outage) is not a winning answer. */
export async function raceConfirmed<T>(saved: Promise<T | null>, fresh: Promise<T>): Promise<T> {
  return Promise.race([fresh, saved.then((answer) => answer ?? fresh, () => fresh)]);
}