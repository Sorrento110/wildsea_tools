import type { OptionCollection } from './types';

const modules = import.meta.glob('../data/ships/*.json', { eager: true }) as Record<
  string,
  { default: OptionCollection }
>;

/**
 * Load every ship collection keyed by its `collection` id.
 *
 * This is intentionally the only place that knows where ship data lives, so
 * future generators can copy the pattern with their own data directory.
 */
export function loadShipCollections(): Record<string, OptionCollection> {
  const collections: Record<string, OptionCollection> = {};
  for (const mod of Object.values(modules)) {
    const collection = mod.default;
    collections[collection.collection] = collection;
  }
  return collections;
}
