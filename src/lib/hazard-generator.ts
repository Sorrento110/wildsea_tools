import { chance, pick, randomInt } from './random';
import type {
  BasicHazard,
  GeneratedHazard,
  HazardCollection,
  HazardEntry,
  HazardOptions,
  HazardTrack,
} from './types';

/** Box ranges suggested by the core rules for each hazard size. */
const LIMIT_RANGES: Record<string, [number, number]> = {
  Basic: [3, 6],
  Small: [3, 6],
  Medium: [7, 12],
  Swarm: [7, 12],
  Various: [7, 12],
  Illness: [7, 12],
  Variable: [7, 20],
  Large: [13, 20],
  Huge: [21, 30],
  Leviathan: [21, 30],
};

/** Forces of nature are a backdrop, so they are layered on rather than drawn. */
const FORCES_OF_NATURE = 'forces-of-nature';
/** Leviathans are game-defining events, so they are opt-in for the general pool. */
const LEVIATHANS = 'leviathans';
/** Chance a general draw also layers on a force-of-nature condition. */
const CONDITION_CHANCE = 0.1;

function tierForLimit(limit: number): string {
  if (limit <= 6) return 'Quick';
  if (limit <= 12) return 'Serious';
  if (limit <= 20) return 'Staying Power';
  return 'Leviathan';
}

/** Build a ready-to-run encounter track from the rules in "Using Hazards". */
function buildTrack(size: string): HazardTrack {
  const [min, max] = LIMIT_RANGES[size] ?? [7, 12];
  const limit = randomInt(min, max);
  const tier = tierForLimit(limit);
  const trackKind: HazardTrack['trackKind'] = pick(['Damage', 'Strategy']);

  const guidance =
    trackKind === 'Damage'
      ? [
          'Split the limit across the hazard\u2019s aspects: weaker aspects take 1\u20133 boxes, durable ones 4 or more.',
          'When an aspect\u2019s track fills, the hazard loses access to it. When every box is marked, the hazard is overcome.',
          'Hazards can have weaknesses and resistances, but each only shifts the damage taken by a single box.',
        ]
      : [
          'Mark a box whenever the crew takes action to deal with the danger.',
          'When the track is full the hazard no longer poses an immediate threat (driven off, contained, or rendered harmless).',
          'Strategic approaches are shorter than combat tracks \u2014 the more effective the plan, the fewer boxes needed.',
        ];

  return {
    tier,
    limit,
    trackKind,
    damageStandard: 'Light damage (1\u20132 marks) as standard',
    damageSpikes: 'Medium (3\u20134) and Heavy (5\u20136) marks as consequences of bad luck or poor tactics',
    guidance,
  };
}

function toGenerated(
  collection: HazardCollection,
  entry: HazardEntry | BasicHazard,
  basic: boolean,
): GeneratedHazard {
  const size = basic ? 'Basic' : (entry as HazardEntry).size;
  return {
    collection: collection.collection,
    category: collection.category,
    name: entry.name,
    size,
    summary: entry.summary,
    basic,
    ...(collection.inPlay ? { inPlay: collection.inPlay } : {}),
    ...(collection.source ? { source: collection.source } : {}),
    track: buildTrack(size),
  };
}

/** Pick one hazard from a collection, honouring the size and basic-hazard options. */
function buildHazard(collection: HazardCollection, options: HazardOptions): GeneratedHazard {
  let pool: HazardEntry[] = collection.hazards;
  if (options.size) {
    const matching = pool.filter((entry) => entry.size === options.size);
    if (matching.length > 0) pool = matching;
  }

  const basic = options.includeBasic ? (collection.basic ?? []) : [];
  if (basic.length > 0) {
    const entry = pick([...pool, ...basic]);
    return toGenerated(collection, entry, !('size' in entry));
  }

  return toGenerated(collection, pick(pool), false);
}

/**
 * Choose a hazard from the categories and attach an encounter track.
 *
 * With no category selected the draw spans every category except forces of
 * nature (layered on as a 10% backdrop condition instead) and leviathans
 * (opt-in via `includeLeviathans`). Naming a category bypasses those rules, so
 * a leviathan or a force of nature can always be generated on demand.
 */
export function generateHazard(
  collections: Record<string, HazardCollection>,
  options: HazardOptions = {},
): GeneratedHazard {
  const all = Object.values(collections);
  if (all.length === 0) {
    throw new Error('generateHazard() called with no collections');
  }

  if (options.collectionId) {
    return buildHazard(collections[options.collectionId] ?? pick(all), options);
  }

  // Asking for a Leviathan-sized hazard is as explicit as choosing the category.
  const allowLeviathans = Boolean(options.includeLeviathans) || options.size === 'Leviathan';

  let pool = all.filter((collection) => {
    if (collection.collection === FORCES_OF_NATURE) return false;
    if (collection.collection === LEVIATHANS) return allowLeviathans;
    return true;
  });
  if (pool.length === 0) pool = all;

  // Prefer categories that can actually satisfy a requested size.
  if (options.size) {
    const withSize = pool.filter((collection) =>
      collection.hazards.some((entry) => entry.size === options.size),
    );
    if (withSize.length > 0) pool = withSize;
  }

  const hazard = buildHazard(pick(pool), options);

  // Forces of nature work best as a condition alongside other events.
  const forces = collections[FORCES_OF_NATURE];
  if (forces && forces.collection !== hazard.collection && chance(CONDITION_CHANCE)) {
    hazard.condition = buildHazard(forces, { includeBasic: options.includeBasic });
  }

  return hazard;
}
