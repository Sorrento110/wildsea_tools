import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'src', 'data');
const schemasDir = join(root, 'src', 'schemas');

const manifestPath = join(dataDir, 'manifest.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listJsonFiles(full));
    } else if (entry.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Every tool declares which schema family its datasets use. Adding a new tool
 * means adding one entry here (and, for a new shape, a schema below).
 */
const TOOL_KINDS = {
  'ship-generator': 'option',
  'watch-results': 'prompt',
  'weather-conditions': 'prompt',
  'points-of-interest': 'poi',
  'hazards': 'hazard',
  // Composite tools own no dataset of their own; they compose other tools' data.
  'journey': 'composite',
};

const validators = {
  option: ajv.compile(readJson(join(schemasDir, 'option-collection.schema.json'))),
  prompt: ajv.compile(readJson(join(schemasDir, 'prompt-collection.schema.json'))),
  poi: ajv.compile(readJson(join(schemasDir, 'poi-collection.schema.json'))),
  hazard: ajv.compile(readJson(join(schemasDir, 'hazard-collection.schema.json'))),
};
const validateManifest = ajv.compile(readJson(join(schemasDir, 'manifest.schema.json')));

const errors = [];

/** Feature ids defined anywhere in the POI dataset, filled before the main pass. */
const poiFeatureIds = new Set();

/**
 * Id registries for the POI dataset, which is split across several files. Ids
 * must be unique across the whole merged dataset, not just within one file.
 */
const poiIdsSeen = { feature: new Map(), layer: new Map(), site: new Map() };

function checkPoiId(kind, id, rel) {
  const seen = poiIdsSeen[kind];
  if (seen.has(id)) {
    fail(rel, `Duplicate ${kind} id "${id}" (also defined in ${seen.get(id)})`);
  } else {
    seen.set(id, rel);
  }
}

function fail(scope, message) {
  errors.push({ scope, message });
}

/** Option collections (currently the ship generator). */
function checkOptionCollection(rel, data) {
  const seen = new Set();
  for (const option of data.options) {
    if (seen.has(option.id)) fail(rel, `Duplicate option id "${option.id}"`);
    seen.add(option.id);
  }

  if (Array.isArray(data.ratingKeys) && data.ratingKeys.length > 0) {
    const allowed = new Set(data.ratingKeys);
    for (const option of data.options) {
      for (const key of Object.keys(option.ratings ?? {})) {
        if (!allowed.has(key)) {
          fail(rel, `Option "${option.id}" uses undeclared rating key "${key}"`);
        }
      }
    }
  }

  const { min, max, allowMultiple } = data.selection;
  if (max !== null && min > max) {
    fail(rel, `Selection min (${min}) is greater than max (${max})`);
  }
  if (allowMultiple === false && max !== null && max !== 1) {
    fail(rel, `allowMultiple is false but max is ${max}; single-choice collections should use max 1 or null`);
  }
}

/** Prompt collections (watch results, weather). */
function checkPromptCollection(rel, data) {
  const outcomeIds = new Set();
  const claimedRolls = new Map();

  for (const outcome of data.outcomes) {
    if (outcomeIds.has(outcome.id)) fail(rel, `Duplicate outcome id "${outcome.id}"`);
    outcomeIds.add(outcome.id);

    for (const roll of outcome.rolls) {
      if (claimedRolls.has(roll)) {
        fail(rel, `d6 result ${roll} is claimed by both "${claimedRolls.get(roll)}" and "${outcome.id}"`);
      }
      claimedRolls.set(roll, outcome.id);
    }

    const promptIds = new Set();
    for (const prompt of outcome.prompts) {
      if (prompt.id) {
        if (promptIds.has(prompt.id)) fail(rel, `Duplicate prompt id "${prompt.id}" in outcome "${outcome.id}"`);
        promptIds.add(prompt.id);
      }
    }
  }
}

/** Points-of-interest files (features, layers, and sites split across files). */
function checkPoiCollection(rel, data) {
  for (const feature of data.features ?? []) {
    checkPoiId('feature', feature.id, rel);
  }

  for (const layer of data.layers ?? []) {
    checkPoiId('layer', layer.id, rel);
    if (layer.secure.length === 0 || layer.perilous.length === 0) {
      fail(rel, `Layer "${layer.id}" needs at least one secure and one perilous sense`);
    }
    if (layer.hooks.length === 0 || layer.encounters.length === 0) {
      fail(rel, `Layer "${layer.id}" needs at least one hook and one encounter`);
    }
  }

  for (const site of data.sites ?? []) {
    checkPoiId('site', site.id, rel);
    if (site.features.length === 0) {
      fail(rel, `Site "${site.id}" lists no features`);
    }
    for (const featureId of site.features) {
      if (!poiFeatureIds.has(featureId)) {
        fail(rel, `Site "${site.id}" references unknown feature "${featureId}"`);
      }
    }
  }
}

/** Hazard collections: one category per file. */
function checkHazardCollection(rel, data) {
  const ids = new Set();
  const names = new Set();
  for (const hazard of data.hazards) {
    if (ids.has(hazard.id)) fail(rel, `Duplicate hazard id "${hazard.id}"`);
    ids.add(hazard.id);
    if (names.has(hazard.name)) fail(rel, `Duplicate hazard name "${hazard.name}"`);
    names.add(hazard.name);
  }
  for (const hazard of data.basic ?? []) {
    if (ids.has(hazard.id)) fail(rel, `Duplicate hazard id "${hazard.id}"`);
    ids.add(hazard.id);
  }
}

// 1. Validate the tool manifest, and ensure each tool points at a real dataset.
if (!existsSync(manifestPath)) {
  fail('manifest', 'Missing src/data/manifest.json');
} else {
  const manifest = readJson(manifestPath);
  if (!validateManifest(manifest)) {
    for (const err of validateManifest.errors ?? []) {
      fail('manifest', `${err.instancePath || '/'} ${err.message}`);
    }
  } else {
    for (const tool of manifest.tools) {
      const kind = TOOL_KINDS[tool.id];
      if (!kind && tool.status === 'active') {
        fail(`tool:${tool.id}`, `Active tool has no entry in TOOL_KINDS in scripts/validate-data.mjs`);
      }
      // Composite tools compose other tools' datasets and own none.
      if (kind === 'composite') continue;
      if (!tool.dataDir) {
        fail(`tool:${tool.id}`, 'Tool has no dataDir and is not a composite tool');
        continue;
      }
      const toolDir = join(dataDir, tool.dataDir);
      if (!existsSync(toolDir)) {
        fail(`tool:${tool.id}`, `Data directory not found: src/data/${tool.dataDir}`);
        continue;
      }
      if (listJsonFiles(toolDir).length === 0) {
        fail(`tool:${tool.id}`, `No collection files found in src/data/${tool.dataDir}`);
      }
    }
  }
}

// 2. Validate every non-manifest JSON file as the dataset shape its tool declares.
const collectionFiles = listJsonFiles(dataDir).filter((f) => f !== manifestPath);
const ordersByTool = new Map();

// Pre-pass: gather every feature id so site references can be checked across files.
for (const file of collectionFiles) {
  try {
    const data = readJson(file);
    if (data.tool === 'points-of-interest') {
      for (const feature of data.features ?? []) poiFeatureIds.add(feature.id);
    }
  } catch {
    // Invalid JSON is reported in the main pass.
  }
}

for (const file of collectionFiles) {
  const rel = relative(root, file);
  let data;
  try {
    data = readJson(file);
  } catch (err) {
    fail(rel, `Invalid JSON: ${err.message}`);
    continue;
  }

  const kind = TOOL_KINDS[data.tool];
  if (!kind) {
    fail(rel, `Unknown tool "${data.tool}"; add it to TOOL_KINDS in scripts/validate-data.mjs`);
    continue;
  }
  if (kind === 'composite') {
    fail(rel, `"${data.tool}" is a composite tool and must not own dataset files`);
    continue;
  }

  const validate = validators[kind];
  if (!validate(data)) {
    for (const err of validate.errors ?? []) {
      fail(rel, `${err.instancePath || '/'} ${err.message}`);
    }
    continue;
  }

  if (kind === 'option') checkOptionCollection(rel, data);
  if (kind === 'prompt') checkPromptCollection(rel, data);
  if (kind === 'poi') checkPoiCollection(rel, data);
  if (kind === 'hazard') checkHazardCollection(rel, data);

  // Collection display order must be unique within a tool.
  if (typeof data.order === 'number') {
    if (!ordersByTool.has(data.tool)) ordersByTool.set(data.tool, new Map());
    const toolOrders = ordersByTool.get(data.tool);
    if (toolOrders.has(data.order)) {
      fail(rel, `Duplicate order ${data.order} in tool "${data.tool}" (also used by ${toolOrders.get(data.order)})`);
    }
    toolOrders.set(data.order, data.collection);
  }
}

if (errors.length > 0) {
  console.error(`Data validation failed with ${errors.length} error(s):\n`);
  for (const { scope, message } of errors) {
    console.error(`  - ${scope}: ${message}`);
  }
  process.exit(1);
}

console.log(`Data validation passed (${collectionFiles.length} collection(s), 1 manifest).`);
