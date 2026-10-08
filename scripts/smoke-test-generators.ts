import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateShip, regenerateSection } from '../src/lib/ship-generator';
import { generatePrompt, formatRollRange } from '../src/lib/prompt-generator';
import { generatePoi } from '../src/lib/poi-generator';
import { generateHazard } from '../src/lib/hazard-generator';
import { generateJourneyLeg } from '../src/lib/journey-generator';
import type {
  HazardCollection,
  OptionCollection,
  PoiCollection,
  PoiDataset,
  PromptCollection,
} from '../src/lib/types';

const root = fileURLToPath(new URL('..', import.meta.url));
const shipsDir = join(root, 'src', 'data', 'ships');

/** Load every JSON dataset in a data directory. */
function loadDir<T>(relDir: string): T[] {
  const dir = join(root, relDir);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T);
}

function loadShipCollections(): Record<string, OptionCollection> {
  const collections: Record<string, OptionCollection> = {};
  for (const file of readdirSync(shipsDir).filter((f) => f.endsWith('.json'))) {
    const collection = JSON.parse(readFileSync(join(shipsDir, file), 'utf8')) as OptionCollection;
    collections[collection.collection] = collection;
  }
  return collections;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function invariant(ship: ReturnType<typeof generateShip>, label: string): void {
  const has = (key: string) => ship.sections.some((s) => s.key === key);
  assert(has('sizes'), `${label}: missing required sizes section`);
  assert(has('frames'), `${label}: missing required frames section`);
  assert(has('hulls'), `${label}: missing required hulls section`);
  assert(has('bites'), `${label}: missing required bites section`);

  const bites = ship.sections.find((s) => s.key === 'bites')?.options ?? [];
  const needsEngine = bites.some((b) => b.meta?.requiresEngine !== false);
  const hasEngine = has('engines');
  assert(needsEngine === hasEngine, `${label}: engine presence does not match bite requirements`);
}

const collections = loadShipCollections();
const keys = Object.keys(collections).sort();
console.log(`Loaded ${keys.length} ship collections: ${keys.join(', ')}`);

for (let i = 0; i < 200; i++) {
  invariant(generateShip(collections), `generate #${i}`);
}

console.log('generateShip invariants passed (200 runs).');

// Spot-check constraint targets (a sample of reachable values).
const constrainedCases = [
  { sizeId: 'standard' },
  { targetRating: { key: 'armour', value: 4 } },
  { targetStakes: 12 },
  { sizeId: 'large', targetRating: { key: 'seals', value: 3 }, targetStakes: 15 },
];

for (const constraints of constrainedCases) {
  for (let i = 0; i < 20; i += 1) {
    const ship = generateShip(collections, constraints);
    if (constraints.sizeId) {
      const size = ship.sections.find((s) => s.key === 'sizes')?.options[0];
      assert(size?.id === constraints.sizeId, `size constraint failed for ${constraints.sizeId}`);
    }
    if (constraints.targetRating) {
      assert(
        ship.ratings[constraints.targetRating.key] === constraints.targetRating.value,
        `rating constraint failed for ${constraints.targetRating.key} ${constraints.targetRating.value}`,
      );
    }
    if (constraints.targetStakes != null) {
      assert(ship.totalStakes === constraints.targetStakes, `stake constraint failed for ${constraints.targetStakes}`);
    }
  }
}

console.log('Constraint spot-checks passed.');

for (let i = 0; i < 200; i++) {
  const ship = generateShip(collections);
  for (const section of ship.sections) {
    invariant(regenerateSection(ship, collections, section.key), `reroll #${i} section ${section.key}`);
  }
}

console.log('regenerateSection invariants passed (200 runs across all sections).');

/* ------------------------------------------------------------------ *
 * Prompt tools (watch, weather), points of interest, and hazards
 * ------------------------------------------------------------------ */

/** Index datasets by their `collection` id. */
function keyByCollection<T extends { collection: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) out[item.collection] = item;
  return out;
}

// Prompt collections. Watch and weather share a shape but stay separate tools.
const watchCollections = keyByCollection(loadDir<PromptCollection>('src/data/watch'));
const weatherCollections = keyByCollection(loadDir<PromptCollection>('src/data/weather'));
const promptCollections: Record<string, PromptCollection> = { ...watchCollections, ...weatherCollections };

for (let i = 0; i < 200; i++) {
  const prompt = generatePrompt(promptCollections);
  assert(prompt.roll >= 1 && prompt.roll <= 6, `prompt roll out of range at #${i}`);
  assert(prompt.text.trim().length > 0, `prompt text empty at #${i}`);
}

console.log(`Prompt invariants passed (200 runs, ${Object.keys(promptCollections).length} collections).`);

// Forced dice inputs: ranges render compactly and reach tables honour a forced d6.
assert(formatRollRange([6]) === '6', `formatRollRange single failed: ${formatRollRange([6])}`);
assert(formatRollRange([5, 4]) === '5\u20134', `formatRollRange pair failed: ${formatRollRange([5, 4])}`);
assert(formatRollRange([3, 2, 1]) === '3\u20131', `formatRollRange run failed: ${formatRollRange([3, 2, 1])}`);

const reach = Object.values(watchCollections).find((collection) =>
  collection.outcomes.some((outcome) => outcome.prompts.some((prompt) => typeof prompt.roll === 'number')),
);
assert(!!reach, 'no reach watch table with numbered prompts found');
for (let roll = 1; roll <= 6; roll += 1) {
  const prompt = generatePrompt({ [reach!.collection]: reach! }, { resultRoll: roll });
  assert(prompt.resultRoll === roll, `forced watch result roll not honoured (${roll})`);
}

console.log('Forced dice inputs passed (roll ranges + reach sub-rolls).');

// Points of interest.
const poiFiles = loadDir<PoiCollection>('src/data/poi');
const dataset: PoiDataset = { features: [], layers: [], sites: [] };
for (const file of poiFiles) {
  dataset.features.push(...(file.features ?? []));
  dataset.layers.push(...(file.layers ?? []));
  dataset.sites.push(...(file.sites ?? []));
}

for (let i = 0; i < 200; i++) {
  const poi = generatePoi(dataset);
  assert(poi.feature.name.length > 0, `poi feature empty at #${i}`);
  assert(poi.sense.text.length > 0, `poi sense empty at #${i}`);
  assert(poi.prompt.length > 0, `poi prompt empty at #${i}`);
  assert(poi.site.features.includes(poi.feature.id), `poi site does not match feature at #${i}`);
}

console.log(
  `Points-of-interest invariants passed (200 runs, ${dataset.features.length} features, ${dataset.sites.length} sites).`,
);

// Hazards.
const hazardCollections = keyByCollection(loadDir<HazardCollection>('src/data/hazards'));

const TIER_BOUNDS: Record<string, [number, number]> = {
  Quick: [3, 6],
  Serious: [7, 12],
  'Staying Power': [13, 20],
  Leviathan: [21, 30],
};

let conditionDraws = 0;

for (let i = 0; i < 400; i++) {
  const hazard = generateHazard(hazardCollections, { includeBasic: i % 2 === 0 });
  const [lo, hi] = TIER_BOUNDS[hazard.track.tier];
  assert(hazard.track.limit >= lo && hazard.track.limit <= hi, `hazard limit outside tier at #${i}`);
  assert(hazard.track.guidance.length > 0, `hazard guidance empty at #${i}`);
  assert(hazard.summary.length > 0, `hazard summary empty at #${i}`);
  assert(
    hazard.collection !== 'forces-of-nature',
    `forces of nature leaked into the general pool at #${i}`,
  );
  assert(hazard.collection !== 'leviathans', `leviathan leaked into the general pool at #${i}`);
  if (hazard.condition) {
    conditionDraws += 1;
    assert(
      hazard.condition.collection === 'forces-of-nature',
      `backdrop condition is not a force of nature at #${i}`,
    );
    assert(hazard.condition.condition === undefined, `backdrop condition nested a condition at #${i}`);
  }
}
assert(conditionDraws > 0, 'forces of nature never appeared as a backdrop condition');

// Leviathans only join the general pool when asked, and always on request.
let leviathanDraws = 0;
for (let i = 0; i < 400; i++) {
  if (generateHazard(hazardCollections, { includeLeviathans: true }).collection === 'leviathans') {
    leviathanDraws += 1;
  }
}
assert(leviathanDraws > 0, 'leviathans never drawn with includeLeviathans');

assert(
  generateHazard(hazardCollections, { collectionId: 'leviathans' }).collection === 'leviathans',
  'explicit leviathan category did not return a leviathan',
);
const explicitForces = generateHazard(hazardCollections, { collectionId: 'forces-of-nature' });
assert(explicitForces.collection === 'forces-of-nature', 'explicit forces category did not return a force of nature');
assert(explicitForces.condition === undefined, 'an explicitly chosen force of nature gained a condition');

for (let i = 0; i < 50; i++) {
  const hazard = generateHazard(hazardCollections, { size: 'Leviathan' });
  assert(hazard.size === 'Leviathan', `Leviathan size filter returned a ${hazard.size} at #${i}`);
}

console.log(
  `Hazard invariants passed (400 runs, ${Object.keys(hazardCollections).length} categories, ${Object.values(
    hazardCollections,
  ).reduce((n, c) => n + c.hazards.length, 0)} hazards; ${conditionDraws} backdrop conditions).`,
);

// Journey legs compose the four tools above into one roll.
for (let i = 0; i < 100; i++) {
  const leg = generateJourneyLeg(
    { watch: watchCollections, weather: weatherCollections, poi: dataset, hazards: hazardCollections },
    { includeBasic: i % 3 === 0 },
  );
  assert(leg.watch.text.trim().length > 0, `journey watch empty at #${i}`);
  assert(leg.weather.text.trim().length > 0, `journey weather empty at #${i}`);
  assert(leg.poi.site.features.includes(leg.poi.feature.id), `journey poi feature mismatch at #${i}`);
  assert(leg.hazard.summary.length > 0, `journey hazard empty at #${i}`);
}

console.log('Journey leg invariants passed (100 runs across all four panels).');
