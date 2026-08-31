import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateShip, regenerateSection } from '../src/lib/ship-generator';
import type { OptionCollection } from '../src/lib/types';

const root = fileURLToPath(new URL('..', import.meta.url));
const shipsDir = join(root, 'src', 'data', 'ships');

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
