import type { PromptCollection } from './types';

const modules = import.meta.glob(['../data/watch/*.json', '../data/weather/*.json'], {
  eager: true,
}) as Record<string, { default: PromptCollection }>;

/**
 * Load every prompt collection owned by a tool, keyed by its `collection` id.
 * Both the Watch Results and Weather tools use the same shape, so one loader
 * serves them both.
 */
export function loadPromptCollections(tool: string): Record<string, PromptCollection> {
  const collections: Record<string, PromptCollection> = {};
  for (const mod of Object.values(modules)) {
    const collection = mod.default;
    if (collection.tool === tool) {
      collections[collection.collection] = collection;
    }
  }
  return collections;
}
