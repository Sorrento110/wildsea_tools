import { chooseCount, pickDistinct } from './generator-core';
import type {
  GeneratedSection,
  GeneratedShip,
  GeneratorOption,
  OptionCollection,
  ShipConstraints,
} from './types';

/** The six ship ratings. Every ship starts at 1 in each, plus option deltas. */
export const SHIP_RATING_KEYS = ['armour', 'seals', 'speed', 'saws', 'stealth', 'tilt'] as const;
export const BASE_RATING = 1;

export const SHIP_RATING_LABELS: Record<string, string> = {
  armour: 'Armour',
  seals: 'Seals',
  speed: 'Speed',
  saws: 'Saws',
  stealth: 'Stealth',
  tilt: 'Tilt',
};

const ENGINE_KEY = 'engines';
const BITE_KEY = 'bites';
const SIZE_KEY = 'sizes';
const FRAME_KEY = 'frames';
const HULL_KEY = 'hulls';

function sectionForCollection(collection: OptionCollection, options: GeneratorOption[]): GeneratedSection {
  return {
    key: collection.collection,
    title: collection.title,
    description: collection.description,
    order: collection.order ?? Number.MAX_SAFE_INTEGER,
    options,
  };
}

/**
 * An engine is required unless every chosen bite explicitly opts out
 * (e.g. sails and beast-reins carry `meta.requiresEngine: false`).
 */
function biteNeedsEngine(bites: GeneratorOption[]): boolean {
  return bites.some((bite) => bite.meta?.requiresEngine !== false);
}

function sumStakes(options: GeneratorOption[]): number {
  return options.reduce((total, option) => total + option.stakes, 0);
}

function sumRating(options: GeneratorOption[], key: string): number {
  return options.reduce((total, option) => total + (option.ratings?.[key] ?? 0), 0);
}

function buildShip(sections: GeneratedSection[], warnings: string[] = []): GeneratedShip {
  const sorted = sections
    .filter((section) => section.options.length > 0)
    .sort((a, b) => a.order - b.order);

  const ratings: Record<string, number> = {};
  for (const key of SHIP_RATING_KEYS) ratings[key] = BASE_RATING;

  let totalStakes = 0;
  for (const section of sorted) {
    for (const option of section.options) {
      totalStakes += option.stakes;
      for (const [key, delta] of Object.entries(option.ratings ?? {})) {
        ratings[key] = (ratings[key] ?? 0) + delta;
      }
    }
  }

  return {
    sections: sorted,
    ratings,
    totalStakes,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

/**
 * Generate all subsets of `items` whose size is between `min` and `max`.
 */
function subsets<T>(items: readonly T[], min: number, max: number): T[][] {
  const out: T[][] = [];
  const limit = Math.min(max, items.length);

  function walk(start: number, current: T[]): void {
    if (current.length >= min && current.length <= limit) {
      out.push([...current]);
    }
    if (current.length === limit) return;
    for (let i = start; i < items.length; i += 1) {
      current.push(items[i]);
      walk(i + 1, current);
      current.pop();
    }
  }

  walk(0, []);
  return out;
}

function optionalCollections(collections: Record<string, OptionCollection>): OptionCollection[] {
  return Object.values(collections).filter((collection) => collection.selection.min === 0);
}

/**
 * Build the random (unconstrained) set of sections, adding an engine only
 * when the chosen bite(s) require one.
 */
function buildSections(collections: Record<string, OptionCollection>, sizeId?: string): GeneratedSection[] {
  const sections: GeneratedSection[] = [];

  for (const collection of Object.values(collections)) {
    if (collection.collection === ENGINE_KEY) continue;

    let options: GeneratorOption[];
    if (collection.collection === SIZE_KEY && sizeId) {
      const forced = collection.options.find((option) => option.id === sizeId);
      options = forced ? [forced] : pickDistinct(collection.options, chooseCount(collection.selection));
    } else {
      options = pickDistinct(collection.options, chooseCount(collection.selection));
    }

    if (options.length > 0) {
      sections.push(sectionForCollection(collection, options));
    }
  }

  const bites = sections.find((section) => section.key === BITE_KEY)?.options ?? [];
  const engine = collections[ENGINE_KEY];
  if (biteNeedsEngine(bites) && engine) {
    const count = chooseCount(engine.selection);
    sections.push(sectionForCollection(engine, pickDistinct(engine.options, count)));
  }

  return sections;
}

function randomOptionalSections(collections: Record<string, OptionCollection>): GeneratedSection[] {
  const sections: GeneratedSection[] = [];
  for (const collection of optionalCollections(collections)) {
    const options = pickDistinct(collection.options, chooseCount(collection.selection));
    if (options.length > 0) {
      sections.push(sectionForCollection(collection, options));
    }
  }
  return sections;
}

/**
 * Build a map of every stake total the optional collections can produce, to a
 * representative set of sections for that total. Used to hit an exact stake
 * target after required sections have been chosen.
 */
function buildOptionalReachable(collections: Record<string, OptionCollection>): Map<number, GeneratedSection[]> {
  let reachable = new Map<number, GeneratedSection[]>([[0, []]]);

  for (const collection of optionalCollections(collections)) {
    const group = new Map<number, GeneratedSection[]>();
    const max = collection.selection.max ?? 3;
    for (const combo of subsets(collection.options, 0, max)) {
      const sum = sumStakes(combo);
      if (!group.has(sum)) {
        group.set(sum, combo.length > 0 ? [sectionForCollection(collection, combo)] : []);
      }
    }

    const next = new Map<number, GeneratedSection[]>();
    for (const [sum, sections] of reachable) {
      for (const [groupSum, groupSections] of group) {
        const total = sum + groupSum;
        if (!next.has(total)) {
          next.set(total, [...sections, ...groupSections]);
        }
      }
    }
    reachable = next;
  }

  return reachable;
}

interface RequiredOutcome {
  size: GeneratorOption;
  frame: GeneratorOption;
  hulls: GeneratorOption[];
  bites: GeneratorOption[];
  engines: GeneratorOption[];
  requiredStakes: number;
}

interface SfhOutcome {
  size: GeneratorOption;
  frame: GeneratorOption;
  hulls: GeneratorOption[];
  stakes: number;
  delta: number;
}

function buildSfhOutcomes(
  sizes: GeneratorOption[],
  frames: GeneratorOption[],
  hullCombos: GeneratorOption[][],
  targetKey: string | undefined,
): SfhOutcome[] {
  const outcomes: SfhOutcome[] = [];
  for (const size of sizes) {
    for (const frame of frames) {
      for (const hulls of hullCombos) {
        const options = [size, frame, ...hulls];
        outcomes.push({
          size,
          frame,
          hulls,
          stakes: sumStakes(options),
          delta: targetKey ? sumRating(options, targetKey) : 0,
        });
      }
    }
  }
  outcomes.sort((a, b) => a.stakes - b.stakes);
  return outcomes;
}

function findRequiredOutcome(
  collections: Record<string, OptionCollection>,
  constraints: ShipConstraints,
  optionalReachable: Map<number, GeneratedSection[]> | null,
): RequiredOutcome | null {
  const sizeCollection = collections[SIZE_KEY];
  const frameCollection = collections[FRAME_KEY];
  const hullCollection = collections[HULL_KEY];
  const biteCollection = collections[BITE_KEY];
  const engineCollection = collections[ENGINE_KEY];
  if (!sizeCollection || !frameCollection || !hullCollection || !biteCollection || !engineCollection) {
    return null;
  }

  const sizes = constraints.sizeId
    ? sizeCollection.options.filter((option) => option.id === constraints.sizeId)
    : sizeCollection.options;
  if (sizes.length === 0) return null;

  const frames = frameCollection.options;
  const hullCombos = subsets(hullCollection.options, 1, hullCollection.selection.max ?? 2);
  const biteCombos = subsets(biteCollection.options, 1, biteCollection.selection.max ?? 2);
  const engineCombos = subsets(engineCollection.options, 1, engineCollection.selection.max ?? 2);

  const targetKey = constraints.targetRating?.key;

  const sfhOutcomes = buildSfhOutcomes(sizes, frames, hullCombos, targetKey);

  const biteData = biteCombos.map((bites) => ({
    bites,
    stakes: sumStakes(bites),
    delta: targetKey ? sumRating(bites, targetKey) : 0,
    needsEngine: biteNeedsEngine(bites),
  }));

  const engineData = engineCombos.map((engines) => ({
    engines,
    stakes: sumStakes(engines),
    delta: targetKey ? sumRating(engines, targetKey) : 0,
  }));
  const noEngine = { engines: [] as GeneratorOption[], stakes: 0, delta: 0 };

  // No numerical targets: the first valid assignment is fine.
  if (!targetKey && constraints.targetStakes == null) {
    const bite = biteData[0];
    const engine = bite.needsEngine ? engineData[0] : noEngine;
    const sfh = sfhOutcomes[0];
    return {
      size: sfh.size,
      frame: sfh.frame,
      hulls: sfh.hulls,
      bites: bite.bites,
      engines: engine.engines,
      requiredStakes: sfh.stakes + bite.stakes + engine.stakes,
    };
  }

  if (targetKey && constraints.targetRating) {
    const targetDelta = constraints.targetRating.value - BASE_RATING;
    const sfhByDelta = new Map<number, SfhOutcome[]>();
    for (const outcome of sfhOutcomes) {
      const list = sfhByDelta.get(outcome.delta) ?? [];
      list.push(outcome);
      sfhByDelta.set(outcome.delta, list);
    }

    for (const bite of biteData) {
      const engines = bite.needsEngine ? engineData : [noEngine];
      for (const engine of engines) {
        const neededDelta = targetDelta - bite.delta - engine.delta;
        const candidates = sfhByDelta.get(neededDelta);
        if (!candidates) continue;

        for (const sfh of candidates) {
          const requiredStakes = sfh.stakes + bite.stakes + engine.stakes;
          if (constraints.targetStakes != null) {
            const remaining = constraints.targetStakes - requiredStakes;
            if (remaining < 0 || !optionalReachable?.has(remaining)) continue;
          }
          return {
            size: sfh.size,
            frame: sfh.frame,
            hulls: sfh.hulls,
            bites: bite.bites,
            engines: engine.engines,
            requiredStakes,
          };
        }
      }
    }
    return null;
  }

  // Only a stake target: pick the cheapest required build that leaves a
  // fillable remainder.
  const sfhByStakes = new Map<number, SfhOutcome>();
  for (const outcome of sfhOutcomes) {
    if (!sfhByStakes.has(outcome.stakes)) sfhByStakes.set(outcome.stakes, outcome);
  }
  const sfhStakes = [...sfhByStakes.keys()].sort((a, b) => a - b);

  for (const bite of biteData) {
    const engines = bite.needsEngine ? engineData : [noEngine];
    for (const engine of engines) {
      for (const sfhStake of sfhStakes) {
        const sfh = sfhByStakes.get(sfhStake)!;
        const requiredStakes = sfhStake + bite.stakes + engine.stakes;
        const remaining = (constraints.targetStakes ?? 0) - requiredStakes;
        if (remaining < 0 || !optionalReachable?.has(remaining)) continue;
        return {
          size: sfh.size,
          frame: sfh.frame,
          hulls: sfh.hulls,
          bites: bite.bites,
          engines: engine.engines,
          requiredStakes,
        };
      }
    }
  }

  return null;
}

function describeConstraintFailure(constraints: ShipConstraints): string {
  const parts: string[] = [];
  if (constraints.sizeId) parts.push(`size "${constraints.sizeId}"`);
  if (constraints.targetRating) {
    const label = SHIP_RATING_LABELS[constraints.targetRating.key] ?? constraints.targetRating.key;
    parts.push(`${label} ${constraints.targetRating.value}`);
  }
  if (constraints.targetStakes != null) parts.push(`${constraints.targetStakes} stakes`);
  return `No exact ship matches ${parts.join(' + ')}; rolled a fresh ship instead.`;
}

function normalizeConstraints(
  collections: Record<string, OptionCollection>,
  constraints: ShipConstraints,
): { constraints: ShipConstraints; warnings: string[] } {
  const normalized: ShipConstraints = {};
  const warnings: string[] = [];

  if (constraints.sizeId) {
    const exists = collections[SIZE_KEY]?.options.some((option) => option.id === constraints.sizeId);
    if (exists) normalized.sizeId = constraints.sizeId;
    else warnings.push(`Unknown size "${constraints.sizeId}" was ignored.`);
  }

  if (constraints.targetRating) {
    const key = constraints.targetRating.key;
    if ((SHIP_RATING_KEYS as readonly string[]).includes(key)) {
      normalized.targetRating = { key, value: constraints.targetRating.value };
    } else {
      warnings.push(`Unknown rating "${key}" was ignored.`);
    }
  }

  if (constraints.targetStakes != null) {
    const stakes = Math.floor(constraints.targetStakes);
    if (Number.isFinite(stakes) && stakes >= 0) normalized.targetStakes = stakes;
  }

  return { constraints: normalized, warnings };
}

/**
 * Generate a complete, rules-plausible NPC ship, optionally satisfying
 * pre-roll constraints (size, a target rating, or an exact stake budget).
 */
export function generateShip(
  collections: Record<string, OptionCollection>,
  constraints: ShipConstraints = {},
): GeneratedShip {
  const { constraints: normalized, warnings } = normalizeConstraints(collections, constraints);
  const hasConstraints = Boolean(normalized.sizeId || normalized.targetRating || normalized.targetStakes != null);

  if (!hasConstraints) {
    return buildShip(buildSections(collections), warnings);
  }

  const optionalReachable = normalized.targetStakes != null ? buildOptionalReachable(collections) : null;
  const required = findRequiredOutcome(collections, normalized, optionalReachable);

  if (!required) {
    return buildShip(buildSections(collections, normalized.sizeId), [
      ...warnings,
      describeConstraintFailure(normalized),
    ]);
  }

  const sections: GeneratedSection[] = [
    sectionForCollection(collections[SIZE_KEY], [required.size]),
    sectionForCollection(collections[FRAME_KEY], [required.frame]),
    sectionForCollection(collections[HULL_KEY], required.hulls),
    sectionForCollection(collections[BITE_KEY], required.bites),
  ];

  if (required.engines.length > 0) {
    sections.push(sectionForCollection(collections[ENGINE_KEY], required.engines));
  }

  if (normalized.targetStakes != null && optionalReachable) {
    const remaining = normalized.targetStakes - required.requiredStakes;
    const optional = optionalReachable.get(remaining);
    if (optional) {
      sections.push(...optional);
    } else {
      warnings.push(`Couldn't spend the remaining ${remaining} stakes on optional fittings.`);
      sections.push(...randomOptionalSections(collections));
    }
  } else {
    sections.push(...randomOptionalSections(collections));
  }

  return buildShip(sections, warnings);
}

/**
 * Rebuild a ship from a compact selection map (collection key -> option ids).
 * Used by deep links to restore an exact generated ship on the full generator
 * page. Missing or unknown ids are ignored.
 */
export function shipFromSelections(
  collections: Record<string, OptionCollection>,
  selection: Record<string, string[]>,
): GeneratedShip {
  const sections: GeneratedSection[] = [];

  for (const [key, ids] of Object.entries(selection)) {
    const collection = collections[key];
    if (!collection) continue;

    const options = ids
      .map((id) => collection.options.find((option) => option.id === id))
      .filter((option): option is GeneratorOption => Boolean(option));

    if (options.length > 0) {
      sections.push(sectionForCollection(collection, options));
    }
  }

  return buildShip(sections);
}

/**
 * Reconcile engine presence with the current bite choices.
 *
 * - Adds an engine when a bite needs one and none is present.
 * - Removes the engine when no chosen bite needs one, matching fresh
 *   generation output (wind- and beast-driven ships show "No engine").
 */
function reconcileEngine(sections: GeneratedSection[], collections: Record<string, OptionCollection>): GeneratedSection[] {
  const bites = sections.find((s) => s.key === BITE_KEY)?.options ?? [];
  const engine = collections[ENGINE_KEY];
  const engineIndex = sections.findIndex((s) => s.key === ENGINE_KEY);

  if (biteNeedsEngine(bites)) {
    if (engineIndex === -1 && engine) {
      sections.push(
        sectionForCollection(engine, pickDistinct(engine.options, chooseCount(engine.selection))),
      );
    }
  } else if (engineIndex !== -1) {
    sections.splice(engineIndex, 1);
  }

  return sections;
}

/**
 * Reroll a single section in place, preserving the rest of the ship.
 * Keeps the same number of options in that section so the shape of the ship
 * doesn't change mid-review; only the specific choices do.
 */
export function regenerateSection(
  ship: GeneratedShip,
  collections: Record<string, OptionCollection>,
  sectionKey: string,
): GeneratedShip {
  const collection = collections[sectionKey];
  if (!collection) return ship;

  const sections = ship.sections.map((section) => ({ ...section, options: [...section.options] }));
  const index = sections.findIndex((section) => section.key === sectionKey);
  if (index === -1) return ship;

  const currentCount = sections[index].options.length;
  const count = Math.max(collection.selection.min, Math.min(currentCount, collection.selection.max ?? currentCount));
  sections[index] = sectionForCollection(collection, pickDistinct(collection.options, count));

  // Only bite changes affect the engine requirement.
  if (sectionKey === BITE_KEY) {
    return buildShip(reconcileEngine(sections, collections));
  }

  return buildShip(sections);
}
