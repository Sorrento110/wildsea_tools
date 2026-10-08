import { pick } from './random';
import type { GeneratedPoi, PoiDataset, PoiFeature, PoiLayer, PoiOptions, PoiSite } from './types';

/**
 * Choose a site that fits the chosen feature and (optionally) layer. Filters
 * are relaxed step by step so a point of interest is always produced, even if
 * the full combination is not represented in the book.
 */
function chooseSite(dataset: PoiDataset, featureId?: string, layerId?: string): PoiSite {
  const byLayer = (site: PoiSite) => !layerId || site.layer === layerId;
  const byFeature = (site: PoiSite) => !featureId || site.features.includes(featureId);

  const exact = dataset.sites.filter((site) => byFeature(site) && byLayer(site));
  if (exact.length > 0) return pick(exact);

  const sameLayer = dataset.sites.filter(byLayer);
  if (sameLayer.length > 0) return pick(sameLayer);

  const sameFeature = dataset.sites.filter(byFeature);
  if (sameFeature.length > 0) return pick(sameFeature);

  return pick(dataset.sites);
}

/** Generate a point of interest: ground, site, sensory detail, prompt, and resources. */
export function generatePoi(dataset: PoiDataset, options: PoiOptions = {}): GeneratedPoi {
  if (dataset.features.length === 0 || dataset.layers.length === 0 || dataset.sites.length === 0) {
    throw new Error('generatePoi() called with an incomplete dataset');
  }

  const site = chooseSite(dataset, options.featureId, options.layerId);

  // The displayed ground always matches the chosen site, so a pinned feature is
  // only used as a filter on the site pool.
  const featureId =
    options.featureId && site.features.includes(options.featureId) ? options.featureId : pick(site.features);
  const feature: PoiFeature =
    dataset.features.find((candidate) => candidate.id === featureId) ?? pick(dataset.features);

  const layer: PoiLayer =
    dataset.layers.find((candidate) => candidate.id === site.layer) ?? pick(dataset.layers);

  const senseKind = options.senseKind ?? pick(['secure', 'perilous'] as const);
  const sensePool = layer[senseKind];
  const sense = sensePool.length > 0 ? pick(sensePool) : pick(layer.secure);

  const promptKind = options.promptKind ?? pick(['hook', 'encounter'] as const);
  const promptPool = promptKind === 'hook' ? layer.hooks : layer.encounters;
  const prompt = promptPool.length > 0 ? pick(promptPool) : pick(layer.hooks);

  return {
    feature,
    layer,
    site,
    senseKind,
    sense,
    promptKind,
    prompt,
    resources: site.resources ?? {},
  };
}
