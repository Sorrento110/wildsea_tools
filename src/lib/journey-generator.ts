import { generateHazard } from './hazard-generator';
import { generatePoi } from './poi-generator';
import { generatePrompt } from './prompt-generator';
import type { GeneratedJourneyLeg, JourneyOptions, JourneySources } from './types';

/**
 * Roll a full journey leg by composing the four journey tools.
 *
 * Each tool keeps its own generation rules; this function only wires them
 * together and forwards any constraints the caller pinned. Watch and weather
 * are separate prompt collections, so they are rolled independently.
 */
export function generateJourneyLeg(
  sources: JourneySources,
  options: JourneyOptions = {},
): GeneratedJourneyLeg {
  return {
    watch: generatePrompt(sources.watch, {
      collectionId: options.watchCollectionId,
      outcomeId: options.watchOutcomeId,
      resultRoll: options.watchResultRoll,
    }),
    weather: generatePrompt(sources.weather, { outcomeId: options.weatherOutcomeId }),
    poi: generatePoi(sources.poi, {
      featureId: options.poiFeatureId,
      layerId: options.poiLayerId,
    }),
    hazard: generateHazard(sources.hazards, {
      collectionId: options.hazardCollectionId,
      size: options.hazardSize,
      includeBasic: options.includeBasic,
      includeLeviathans: options.includeLeviathans,
    }),
  };
}
