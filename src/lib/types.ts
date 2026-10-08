/** Rating deltas applied to a ship (or other generated result). */
export type RatingMap = Record<string, number>;

/** A single selectable option in a generator collection. */
export interface GeneratorOption {
  id: string;
  name: string;
  category?: string;
  stakes: number;
  description: string;
  ratings?: RatingMap;
  tags?: string[];
  source: string;
  special?: string | null;
  /** Tool-specific free-form metadata (e.g. { requiresEngine: false } for sail bites). */
  meta?: Record<string, unknown>;
}

/** Selection rules for a collection. */
export interface SelectionRules {
  min: number;
  max: number | null;
  allowMultiple: boolean;
}

/** Constraints a caller can impose on a generated ship. */
export interface ShipConstraints {
  /** Force a specific size option id (e.g. "standard"). */
  sizeId?: string;
  /** Require one of the six ratings to land exactly on this value. */
  targetRating?: { key: string; value: number };
  /** Require the ship to spend exactly this many stakes. */
  targetStakes?: number;
}

/** One rendered section of a generated ship (a collection plus its picks). */
export interface GeneratedSection {
  key: string;
  title: string;
  description?: string;
  order: number;
  options: GeneratorOption[];
}

/** A complete generated ship result. */
export interface GeneratedShip {
  sections: GeneratedSection[];
  ratings: Record<string, number>;
  totalStakes: number;
  /** Human-readable notes, e.g. when a requested target could not be matched. */
  warnings?: string[];
}

/** A single JSON dataset for one generator. */
export interface OptionCollection {
  tool: string;
  collection: string;
  title: string;
  description?: string;
  order?: number;
  selection: SelectionRules;
  ratingKeys?: string[];
  options: GeneratorOption[];
}

/** A registered generator tool, read from the landing page. */
export interface ToolEntry {
  id: string;
  name: string;
  route: string;
  description: string;
  dataDir: string;
  status: 'active' | 'planned';
}

export interface ToolManifest {
  title: string;
  description: string;
  tools: ToolEntry[];
}

/* ------------------------------------------------------------------ *
 * Prompt collections (Watch Results, Weather Conditions)
 * ------------------------------------------------------------------ */

/** A single prompt that can be rolled on a d6 outcome. */
export interface Prompt {
  id?: string;
  /** When present, the prompt is pinned to this d6 value on the outcome's sub-table. */
  roll?: number;
  text: string;
}

/** One outcome of a d6 prompt table (e.g. Peace, Order, Nature). */
export interface PromptOutcome {
  id: string;
  name: string;
  /** d6 values that map to this outcome (e.g. [5, 4]). */
  rolls: number[];
  description?: string;
  prompts: Prompt[];
}

/** A data-driven collection of prompts (one watch table, one weather table). */
export interface PromptCollection {
  tool: string;
  collection: string;
  title: string;
  description?: string;
  source?: string;
  order?: number;
  rollLabel?: string;
  outcomes: PromptOutcome[];
}

/** The result of rolling a prompt collection. */
export interface GeneratedPrompt {
  collection: string;
  title: string;
  rollLabel?: string;
  /** The category-driving d6 result. */
  roll: number;
  outcome: string;
  outcomeDescription?: string;
  /** The sub-table d6 result, when the table numbers its prompts. */
  resultRoll?: number;
  text: string;
  source?: string;
}

/** Options for generating a prompt. */
export interface PromptOptions {
  /** Force a specific collection id; otherwise a random one is used. */
  collectionId?: string;
  /** Force a specific outcome id (e.g. "nature"); otherwise the d6 decides. */
  outcomeId?: string;
  /**
   * Force the sub-table d6 result (1-6) on tables that number their prompts
   * (the per-reach watch tables). Ignored by tables without numbered prompts.
   */
  resultRoll?: number;
}

/* ------------------------------------------------------------------ *
 * Points of Interest
 * ------------------------------------------------------------------ */

/** A single sensory detail, e.g. { sense: "Sight", text: "..." }. */
export interface PoiSense {
  sense: string;
  text: string;
}

/** A kind of solid ground a point of interest can be built on. */
export interface PoiFeature {
  id: string;
  name: string;
  description: string;
  source?: string;
}

/** A layer of the sea, with sensory prompts and hooks/encounters. */
export interface PoiLayer {
  id: string;
  name: string;
  description?: string;
  source?: string;
  secure: PoiSense[];
  perilous: PoiSense[];
  hooks: string[];
  encounters: string[];
}

/** Sample resources found at a site. */
export interface PoiResources {
  salvage?: string[];
  specimens?: string[];
  whispers?: string[];
  charts?: string[];
  cargo?: string[];
}

/** A named kind of location within a layer. */
export interface PoiSite {
  id: string;
  name: string;
  layer: string;
  features: string[];
  description: string;
  source?: string;
  resources?: PoiResources;
}

/** One points-of-interest data file; any subset of the three lists. */
export interface PoiCollection {
  tool: string;
  collection: string;
  title: string;
  description?: string;
  order?: number;
  source?: string;
  features?: PoiFeature[];
  layers?: PoiLayer[];
  sites?: PoiSite[];
}

/** The merged points-of-interest dataset used by the generator. */
export interface PoiDataset {
  features: PoiFeature[];
  layers: PoiLayer[];
  sites: PoiSite[];
}

/** The result of generating a point of interest. */
export interface GeneratedPoi {
  feature: PoiFeature;
  layer: PoiLayer;
  site: PoiSite;
  senseKind: 'secure' | 'perilous';
  sense: PoiSense;
  promptKind: 'hook' | 'encounter';
  prompt: string;
  resources: PoiResources;
}

/** Options for generating a point of interest. */
export interface PoiOptions {
  featureId?: string;
  layerId?: string;
  senseKind?: 'secure' | 'perilous';
  promptKind?: 'hook' | 'encounter';
}

/* ------------------------------------------------------------------ *
 * Hazards
 * ------------------------------------------------------------------ */

/** A named complex hazard entry. */
export interface HazardEntry {
  id: string;
  name: string;
  size: string;
  summary: string;
  source?: string;
}

/** A short basic hazard. */
export interface BasicHazard {
  id: string;
  name: string;
  summary: string;
}

/** One category of hazards. */
export interface HazardCollection {
  tool: string;
  collection: string;
  title: string;
  category: string;
  description?: string;
  order?: number;
  source?: string;
  inPlay?: string;
  basic?: BasicHazard[];
  hazards: HazardEntry[];
}

/** A generated encounter track for a hazard, following the core rules. */
export interface HazardTrack {
  /** Quick / Serious / Staying Power / Leviathan. */
  tier: string;
  /** Total boxes shared between the hazard's tracks. */
  limit: number;
  trackKind: 'Damage' | 'Strategy';
  damageStandard: string;
  damageSpikes: string;
  guidance: string[];
}

/** A fully generated hazard encounter. */
export interface GeneratedHazard {
  collection: string;
  category: string;
  name: string;
  size: string;
  summary: string;
  basic: boolean;
  inPlay?: string;
  source?: string;
  track: HazardTrack;
  /**
   * A force of nature layered on as a backdrop condition. Only added on general
   * ("Any" category) draws, so it never appears on an explicitly chosen hazard.
   */
  condition?: GeneratedHazard;
}

/** Options for generating a hazard encounter. */
export interface HazardOptions {
  collectionId?: string;
  /** Restrict to a hazard size (e.g. "Large", "Leviathan"). */
  size?: string;
  /** Allow short basic hazards into the pool. Defaults to false. */
  includeBasic?: boolean;
  /**
   * Allow leviathans into the general "Any" pool. Defaults to false — they are
   * game-defining, so they are opt-in (or chosen directly by category).
   */
  includeLeviathans?: boolean;
}

/* ------------------------------------------------------------------ *
 * Journey leg (a composition of the watch, weather, POI, and hazard tools)
 * ------------------------------------------------------------------ */

/** Everything a journey leg needs to roll against. */
export interface JourneySources {
  watch: Record<string, PromptCollection>;
  weather: Record<string, PromptCollection>;
  poi: PoiDataset;
  hazards: Record<string, HazardCollection>;
}

/** Per-tool constraints for a journey leg. All are optional. */
export interface JourneyOptions {
  /** Pin the watch table (a Reach id such as "core" or "the-foxloft"). */
  watchCollectionId?: string;
  /** Pin the watch outcome category (e.g. "nature"). */
  watchOutcomeId?: string;
  /** Pin the watch sub-table d6 result (1-6) on reach tables. */
  watchResultRoll?: number;
  /** Pin the weather outcome category (e.g. "clear-skies"). */
  weatherOutcomeId?: string;
  /** Pin the hazard category. */
  hazardCollectionId?: string;
  /** Pin the hazard size (e.g. "Large", "Leviathan"). */
  hazardSize?: string;
  /** Allow short basic hazards into the pool. Defaults to false. */
  includeBasic?: boolean;
  /** Allow leviathans into the general hazard pool. Defaults to false. */
  includeLeviathans?: boolean;
  /** Pin the POI ground/feature. */
  poiFeatureId?: string;
  /** Pin the POI sea layer. */
  poiLayerId?: string;
}

/** One leg of a journey: what the watch sees, the sky's turn, where they land, and what threatens them. */
export interface GeneratedJourneyLeg {
  watch: GeneratedPrompt;
  weather: GeneratedPrompt;
  poi: GeneratedPoi;
  hazard: GeneratedHazard;
}
