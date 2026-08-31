import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'src', 'data');
const schemasDir = join(root, 'src', 'schemas');

const manifestPath = join(dataDir, 'manifest.json');
const manifestSchemaPath = join(schemasDir, 'manifest.schema.json');
const optionSchemaPath = join(schemasDir, 'option-collection.schema.json');

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
const validateManifest = ajv.compile(readJson(manifestSchemaPath));
const validateCollection = ajv.compile(readJson(optionSchemaPath));

const errors = [];

function fail(scope, message) {
  errors.push({ scope, message });
}

// 1. Validate the tool manifest.
if (!existsSync(manifestPath)) {
  fail('manifest', 'Missing src/data/manifest.json');
} else {
  const manifest = readJson(manifestPath);
  if (!validateManifest(manifest)) {
    for (const err of validateManifest.errors ?? []) {
      fail('manifest', `${err.instancePath || '/'} ${err.message}`);
    }
  } else {
    // 2. Ensure each manifest tool has a data directory containing collections.
    for (const tool of manifest.tools) {
      const toolDir = join(dataDir, tool.dataDir);
      if (!existsSync(toolDir)) {
        fail(`tool:${tool.id}`, `Data directory not found: src/data/${tool.dataDir}`);
        continue;
      }
      const toolCollections = listJsonFiles(toolDir);
      if (toolCollections.length === 0) {
        fail(`tool:${tool.id}`, `No collection files found in src/data/${tool.dataDir}`);
      }
    }
  }
}

// 3. Validate every non-manifest JSON file as an option collection.
const collectionFiles = listJsonFiles(dataDir).filter((f) => f !== manifestPath);
const ordersByTool = new Map();
for (const file of collectionFiles) {
  const rel = relative(root, file);
  let data;
  try {
    data = readJson(file);
  } catch (err) {
    fail(rel, `Invalid JSON: ${err.message}`);
    continue;
  }

  if (!validateCollection(data)) {
    for (const err of validateCollection.errors ?? []) {
      fail(rel, `${err.instancePath || '/'} ${err.message}`);
    }
    continue;
  }

  // Custom semantic checks below (still useful even when schema passes).

  // Unique option ids within a collection.
  const seen = new Set();
  for (const option of data.options) {
    if (seen.has(option.id)) {
      fail(rel, `Duplicate option id "${option.id}"`);
    }
    seen.add(option.id);
  }

  // Rating keys must be declared in the collection's ratingKeys, when provided.
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

  // Selection min/max sanity.
  const { min, max, allowMultiple } = data.selection;
  if (max !== null && min > max) {
    fail(rel, `Selection min (${min}) is greater than max (${max})`);
  }
  if (allowMultiple === false && max !== null && max !== 1) {
    fail(rel, `allowMultiple is false but max is ${max}; single-choice collections should use max 1 or null`);
  }

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
