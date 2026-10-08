import { pick, randomInt } from './random';
import type { GeneratedPrompt, Prompt, PromptCollection, PromptOptions, PromptOutcome } from './types';

/** Collapse a set of d6 values into a compact label: [6] → "6", [5, 4] → "5–4", [3, 2, 1] → "3–1". */
export function formatRollRange(rolls: number[]): string {
  if (rolls.length === 0) return '';
  const sorted = [...rolls].sort((a, b) => b - a);

  const runs: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (value === previous - 1) {
      previous = value;
      continue;
    }
    runs.push(start === previous ? `${start}` : `${start}\u2013${previous}`);
    start = value;
    previous = value;
  }
  runs.push(start === previous ? `${start}` : `${start}\u2013${previous}`);
  return runs.join(', ');
}

/** Whether a table numbers its prompts and so is read with a second d6. */
export function outcomeHasNumberedPrompts(outcome: PromptOutcome): boolean {
  return outcome.prompts.some((prompt) => typeof prompt.roll === 'number');
}

/** Find the outcome a d6 result maps to, if any. */
function outcomeForRoll(outcomes: PromptOutcome[], roll: number): PromptOutcome | undefined {
  return outcomes.find((outcome) => outcome.rolls.includes(roll));
}

/**
 * Choose the prompt within an outcome.
 *
 * Some tables (the per-reach watch tables) number each prompt 1-6 and are read
 * with a second d6; others (the core watch and weather tables) present a short
 * pool of prompts to pick from.
 */
function choosePrompt(
  outcome: PromptOutcome,
  forcedResultRoll?: number,
): { prompt: Prompt; resultRoll?: number } {
  if (!outcomeHasNumberedPrompts(outcome)) {
    return { prompt: pick(outcome.prompts) };
  }

  const resultRoll = forcedResultRoll ?? randomInt(1, 6);
  const prompt = outcome.prompts.find((candidate) => candidate.roll === resultRoll) ?? pick(outcome.prompts);
  return { prompt, resultRoll };
}

/**
 * Roll on a prompt collection. By default the d6 decides the outcome category
 * (6 / 5-4 / 3-1), matching how the tables are read at the table. Callers can
 * pin a specific collection and/or outcome category.
 */
export function generatePrompt(
  collections: Record<string, PromptCollection>,
  options: PromptOptions = {},
): GeneratedPrompt {
  const all = Object.values(collections);
  if (all.length === 0) {
    throw new Error('generatePrompt() called with no collections');
  }

  const collection =
    (options.collectionId && collections[options.collectionId]) || pick(all);

  let outcome: PromptOutcome;
  let roll: number;

  if (options.outcomeId) {
    outcome = collection.outcomes.find((candidate) => candidate.id === options.outcomeId) ?? pick(collection.outcomes);
    roll = pick(outcome.rolls);
  } else {
    roll = randomInt(1, 6);
    const matched = outcomeForRoll(collection.outcomes, roll);
    if (matched) {
      outcome = matched;
    } else {
      outcome = pick(collection.outcomes);
      roll = pick(outcome.rolls);
    }
  }

  const { prompt, resultRoll } = choosePrompt(outcome, options.resultRoll);

  return {
    collection: collection.collection,
    title: collection.title,
    ...(collection.rollLabel ? { rollLabel: collection.rollLabel } : {}),
    roll,
    outcome: outcome.name,
    ...(outcome.description ? { outcomeDescription: outcome.description } : {}),
    ...(resultRoll !== undefined ? { resultRoll } : {}),
    text: prompt.text,
    ...(collection.source ? { source: collection.source } : {}),
  };
}
