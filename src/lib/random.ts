/**
 * Random helpers shared by generators.
 *
 * Kept framework-free so they can also be used from plain `.astro`/`.ts` code.
 */

export function randomInt(min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** Return true with the given probability (0–1). */
export function chance(probability: number): boolean {
  return Math.random() < probability;
}

export function pick<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick() called on an empty list');
  }
  return items[randomInt(0, items.length - 1)];
}

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
