import type { HazardCollection } from './types';

const modules = import.meta.glob('../data/hazards/*.json', { eager: true }) as Record<
  string,
  { default: HazardCollection }
>;

/** Load every hazard category, keyed by its `collection` id. */
export function loadHazardCollections(): Record<string, HazardCollection> {
  const collections: Record<string, HazardCollection> = {};
  for (const mod of Object.values(modules)) {
    const collection = mod.default;
    collections[collection.collection] = collection;
  }
  return collections;
}
