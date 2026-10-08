import type { PoiCollection, PoiDataset } from './types';

const modules = import.meta.glob('../data/poi/*.json', { eager: true }) as Record<
  string,
  { default: PoiCollection }
>;

/**
 * Load and merge every points-of-interest data file. Features, layers, and
 * sites are split across files for readability but behave as one dataset.
 */
export function loadPoiDataset(): PoiDataset {
  const dataset: PoiDataset = { features: [], layers: [], sites: [] };
  const files = Object.values(modules)
    .map((mod) => mod.default)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const file of files) {
    if (file.features) dataset.features.push(...file.features);
    if (file.layers) dataset.layers.push(...file.layers);
    if (file.sites) dataset.sites.push(...file.sites);
  }

  return dataset;
}
