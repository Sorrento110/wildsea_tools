# Contributing

Generators on this site are **data-driven**. Adding content usually means editing JSON,
not changing component code.

## Repository layout

```
src/
  data/
    manifest.json          # Tool registry shown on the landing page
    <tool>/                # One folder per generator (e.g. ships/)
      <collection>.json    # One file per dataset
  lib/
    types.ts               # Shared data types
    random.ts              # RNG helpers
    generator-core.ts      # Collection-agnostic picking helpers
    html.ts                # Shared HTML escaping
    ship-data.ts           # Loads the ship collections
    ship-generator.ts      # Ship-specific generation logic
    ship-render.ts         # HTML + plain-text rendering for ships
    prompt-data.ts         # Loads watch + weather prompt collections
    prompt-generator.ts    # d6 prompt rolling
    prompt-render.ts       # HTML + plain-text rendering for prompts
    poi-data.ts            # Loads the points-of-interest dataset
    poi-generator.ts       # Points-of-interest generation
    poi-render.ts          # HTML + plain-text rendering for points of interest
    hazard-data.ts         # Loads the hazard categories
    hazard-generator.ts    # Hazard picking + encounter-track generation
    hazard-render.ts       # HTML + plain-text rendering for hazards
  schemas/
    manifest.schema.json
    option-collection.schema.json
    prompt-collection.schema.json
    poi-collection.schema.json
    hazard-collection.schema.json
scripts/
  add-option.mjs           # Guided scaffolder for adding options
  validate-data.mjs        # Validates every dataset
  smoke-test-generators.ts # Generator logic invariants
```

Each generator owns a directory under `src/data/`. Each JSON file inside that directory is a
single dataset (collection). This keeps concerns separated: editing one collection never
risks another tool's data.

## Dataset kinds

Tools declare which schema family their files use in the `TOOL_KINDS` map at the top of
`scripts/validate-data.mjs`. Four kinds exist today:

| Kind        | Schema                          | Tools                                   |
| ----------- | ------------------------------- | --------------------------------------- |
| `option`    | `option-collection.schema.json` | Ship Generator                          |
| `prompt`    | `prompt-collection.schema.json` | Watch Results, Weather Conditions       |
| `poi`       | `poi-collection.schema.json`    | Points of Interest                      |
| `hazard`    | `hazard-collection.schema.json` | Hazards                                 |
| `composite` | _none_                          | Journey Dashboard                       |

Add a new tool by adding an entry to `TOOL_KINDS` (and a schema if it uses a new shape).
A `composite` tool owns no dataset: it composes other tools' data (the Journey Dashboard
rolls watch, weather, POI, and hazards together), so it omits `dataDir` in the manifest.

## Adding an option to an existing generator

The fastest path is the guided scaffolder:

```sh
npm run add-option
```

The scaffolder asks which **tool** and which **dataset** the option belongs to, then walks
through the option fields and re-runs validation. You can skip the tool/dataset prompts with
flags:

```sh
npm run add-option -- --tool ship-generator --collection hulls
```

Use `--list` to see every tool and dataset at a glance:

```sh
npm run add-option -- --list
```

You can also hand-edit the relevant JSON file. Every dataset follows the
`option-collection.schema.json` shape:

```json
{
  "$schema": "../../schemas/option-collection.schema.json",
  "tool": "ship-generator",
  "collection": "hulls",
  "title": "Ship Hulls",
  "selection": { "min": 1, "max": null, "allowMultiple": true },
  "ratingKeys": ["armour", "seals", "speed", "saws", "stealth", "tilt"],
  "options": [
    {
      "id": "reef-iron",
      "name": "Reef-Iron",
      "category": "common",
      "stakes": 1,
      "description": "Metal plating from decommissioned ships.",
      "ratings": { "armour": 1 },
      "tags": ["metal"],
      "source": "Core Rules p.169",
      "special": null
    }
  ]
}
```

### Field notes

- `id` — lowercase slug, unique within the collection.
- `order` — integer used to display sections in a stable, sensible sequence. Unique within a tool.
- `ratings` — map of rating key to an integer delta. Keys must be listed in the collection's
  `ratingKeys` when that array is non-empty.
- `selection` — `min`/`max` describe how many options the generator must/can pick
  (`max: null` means unlimited).
- `meta` — tool-specific free-form data. For example, ship bite options that work without an
  engine use `"meta": { "requiresEngine": false }`.
- `source` — cite the rulebook page so content stays traceable. Keep descriptions
  **paraphrased**, not verbatim, for copyright safety.

## Adding a whole new generator

The ship generator is the reference implementation for option collections. To add a generator:

1. Create a directory: `src/data/<new-tool>/`.
2. Add one JSON file per dataset, following the schema for its kind (see **Dataset kinds**).
3. Register the tool in `src/data/manifest.json` (`id`, `name`, `route`, `description`,
   `dataDir`, `status`) — composite tools omit `dataDir` — and add the tool to `TOOL_KINDS` in
   `scripts/validate-data.mjs`.
4. Add a loader module like `src/lib/ship-data.ts` for the new data directory.
5. Add a generator module like `src/lib/ship-generator.ts` for the tool's rules,
   reusing `src/lib/random.ts` for generic picking.
6. Add a render module like `src/lib/ship-render.ts` so server and client markup stay in one place.
7. Add an Astro page at the matching route under `src/pages/`, plus a component that
   embeds the initial result and wires up client-side reroll controls.
8. Extend `scripts/smoke-test-generators.ts` (or add a sibling) to cover the new tool's invariants.
9. Run `npm run validate:data`, `npm test`, and `npm run build`.

## Validation and tests

```sh
npm run validate:data
npm test
```

Validation checks JSON shape against the schema for the tool's kind, plus:

- option collections: unique option `id`s, rating keys declared in `ratingKeys`, selection
  `min`/`max` sanity
- prompt collections: unique outcome ids, no two outcomes claiming the same d6 result,
  unique prompt ids within an outcome
- points-of-interest files: unique feature/layer/site ids across the merged dataset, layers with
  senses and hooks, and site feature references that resolve to a known land feature
- hazard collections: unique hazard ids and names within a category
- unique `order` per tool

The smoke test runs the ship generator, the prompt rollers, the points-of-interest generator,
and the hazard generator many times, asserting the invariants each tool relies on.

CI runs both before every build.
