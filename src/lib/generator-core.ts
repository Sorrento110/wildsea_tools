import { randomInt, shuffle } from './random';
import type { GeneratorOption, SelectionRules } from './types';

/**
 * Pick `count` distinct options from a collection, shuffled so repeated
 * generations vary even when the same count is chosen.
 */
export function pickDistinct<T>(items: readonly T[], count: number): T[] {
  if (count <= 0) return [];
  if (count >= items.length) return shuffle(items);
  return shuffle(items).slice(0, count);
}

/**
 * Decide how many options to select for a collection based on its rules.
 *
 * Bounded collections roll uniformly within [min, max]. Unlimited collections
 * (max: null) use a practical cap so generated results stay readable.
 */
export function chooseCount(selection: SelectionRules): number {
  const { min, max } = selection;

  if (max === null) {
    const practicalMax = min === 0 ? 3 : Math.max(min, Math.min(min + 2, 3));
    return randomInt(min, practicalMax);
  }

  return randomInt(min, max);
}

/**
 * Resolve a collection to a concrete list of chosen options.
 *
 * Part of the shared generator-core surface for future generators
 * (see CONTRIBUTING.md); nothing uses it yet.
 */
export function pickOptions(collection: {
  selection: SelectionRules;
  options: GeneratorOption[];
}): GeneratorOption[] {
  return pickDistinct(collection.options, chooseCount(collection.selection));
}
