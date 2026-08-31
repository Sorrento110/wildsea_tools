import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawnSync } from 'node:child_process';

const scriptsDir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(scriptsDir, '..');
const dataDir = join(root, 'src', 'data');
const manifestPath = join(dataDir, 'manifest.json');

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseArgs(argv) {  const args = { tool: null, collection: null, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tool') args.tool = argv[++i] ?? null;
    else if (arg === '--collection') args.collection = argv[++i] ?? null;
    else if (arg === '--list' || arg === '-l') args.list = true;
  }
  return args;
}

async function selectNumbered(ask, list, format, invalidMessage) {
  list.forEach((item, i) => console.log(`  ${i + 1}. ${format(item)}`));
  const choice = await ask('\nEnter number');
  const item = list[Number.parseInt(choice, 10) - 1];
  if (!item) throw new Error(invalidMessage);
  return item;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  const rl = createInterface({ input, output });

  const ask = async (question, fallback = null) => {
    const suffix = fallback !== null && fallback !== undefined ? ` [${fallback}]` : '';
    const answer = (await rl.question(`${question}${suffix}: `)).trim();
    return answer === '' ? fallback : answer;
  };

  try {
    if (args.list) {
      console.log('Available tools and their datasets:\n');
      for (const tool of manifest.tools) {
        console.log(`  ${tool.id}  (${tool.name})`);
        const collections = await listCollections(tool.dataDir);
        for (const c of collections) {
          console.log(`    - ${c.collection}  (${c.title})`);
        }
        console.log('');
      }
      return;
    }

    // 1. Pick the tool (generator family).
    let tool;
    if (args.tool) {
      tool = manifest.tools.find((t) => t.id === args.tool);
      if (!tool) {
        throw new Error(`Unknown tool "${args.tool}". Run --list to see available tools.`);
      }
    } else {
      console.log('Which tool does this option belong to?\n');
      tool = await selectNumbered(
        ask,
        manifest.tools,
        (t) => `${t.id}  (${t.name})`,
        'Invalid tool selection.',
      );
    }
    console.log(`\nTool: ${tool.id} (${tool.name})\n`);

    // 2. Pick the collection (dataset within that tool).
    const collections = await listCollections(tool.dataDir);
    if (collections.length === 0) {
      throw new Error(`No collection files found in src/data/${tool.dataDir}`);
    }

    let collection;
    if (args.collection) {
      collection = collections.find((c) => c.collection === args.collection);
      if (!collection) {
        throw new Error(
          `Unknown collection "${args.collection}" for tool "${tool.id}". Run --list to see available datasets.`,
        );
      }
    } else {
      console.log('Which dataset should the option be added to?\n');
      collection = await selectNumbered(
        ask,
        collections,
        (c) => `${c.collection}  (${c.title})`,
        'Invalid dataset selection.',
      );
    }
    console.log(
      `\nDataset: ${collection.collection} (${collection.title}) — selection min ${collection.data.selection.min}, max ${
        collection.data.selection.max ?? 'unlimited'
      }, allowMultiple ${collection.data.selection.allowMultiple}\n`,
    );

    // 3. Gather option fields.
    console.log('Enter the new option. Leave optional fields blank to skip them.\n');
    const name = await ask('Name (required)');
    if (!name) throw new Error('Name is required.');

    const id = await ask('ID (slug)', slugify(name));
    if (collection.data.options.some((o) => o.id === id)) {
      throw new Error(`An option with id "${id}" already exists in ${collection.collection}.json`);
    }

    const category = await ask('Category', 'common');
    const stakesRaw = await ask('Stakes (number)', '0');
    const stakes = Number.parseInt(stakesRaw, 10);
    if (Number.isNaN(stakes) || stakes < 0) throw new Error('Stakes must be a non-negative integer.');

    const description = await ask('Description (required)');
    if (!description) throw new Error('Description is required.');

    const source = await ask('Source (e.g. "Core Rules p.170")');
    if (!source) throw new Error('Source is required.');

    const option = {
      id,
      name,
      category,
      stakes,
      description,
      source,
    };

    const ratingsRaw = await ask('Ratings (e.g. "armour:+1,stealth:-1")');
    if (ratingsRaw) {
      const ratings = {};
      for (const pair of ratingsRaw.split(',')) {
        const [key, value] = pair.split(':').map((s) => s.trim());
        if (!key || Number.isNaN(Number(value))) {
          throw new Error(`Invalid ratings entry "${pair}". Use key:+1 or key:-1 format.`);
        }
        ratings[key] = Number.parseInt(value, 10);
      }
      option.ratings = ratings;
    }

    const tagsRaw = await ask('Tags (comma-separated)');
    if (tagsRaw) {
      const tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      if (tags.length > 0) option.tags = tags;
    }

    const special = await ask('Special rule (optional)');
    if (special) option.special = special;

    const metaRaw = await ask('Meta JSON (optional, e.g. {"requiresEngine":false})');
    if (metaRaw) {
      try {
        option.meta = JSON.parse(metaRaw);
      } catch {
        throw new Error('Meta must be valid JSON.');
      }
    }

    // 4. Append to the correct dataset file.
    collection.data.options.push(option);
    const payload = `${JSON.stringify(collection.data, null, 2)}\n`;
    await writeFile(collection.filePath, payload, 'utf8');

    console.log(`\nAdded option "${option.id}" to ${collection.collection}.json.\n`);

    // 5. Re-validate all data.
    console.log('Running data validation...\n');
    const result = spawnSync(process.execPath, [join(root, 'scripts', 'validate-data.mjs')], {
      cwd: root,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      console.error('\nOption was added but validation failed. Fix the data and re-run `npm run validate:data`.');
      process.exitCode = 1;
    }
  } finally {
    rl.close();
  }
}

async function listCollections(dataDirName) {
  const dir = join(dataDir, dataDirName);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const collections = [];
  for (const file of files) {
    const filePath = join(dir, file);
    const data = JSON.parse(await readFile(filePath, 'utf8'));
    collections.push({ filePath, collection: data.collection, title: data.title, data });
  }
  return collections;
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exitCode = 1;
});
