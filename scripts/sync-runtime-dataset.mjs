import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { readJson } from './dataset-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const publicDir = resolve(rootDir, 'public');
const runtimePath = resolve(rootDir, 'src/data/runtime.json');
const sourceCheckPath = resolve(rootDir, 'src/data/source-check.json');
const publicRuntimePath = resolve(publicDir, 'runtime.json');
const publicMetaPath = resolve(publicDir, 'runtime.meta.json');
const sitemapPath = resolve(publicDir, 'sitemap.xml');

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function main() {
  await ensureDir(publicDir);
  await copyFile(runtimePath, publicRuntimePath);
  await copyFile(sourceCheckPath, resolve(publicDir, 'source-check.json'));

  const runtime = await readJson(runtimePath, null);
  if (!runtime) {
    throw new Error('Missing runtime dataset. Run npm run data:update first.');
  }

  const meta = {
    checkedAt: runtime.checkedAt,
    countryCount: runtime.meta.countryCount,
    lastChangedAt: runtime.meta.lastChangedAt,
    qualificationCount: runtime.meta.qualificationCount,
    scheduleCount: runtime.meta.scheduleCount,
    sportCount: runtime.meta.sportCount
  };

  await writeFile(publicMetaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  const urls = [
    'https://games28.paulzuiderduin.com/',
    'https://games28.paulzuiderduin.com/schedule',
    'https://games28.paulzuiderduin.com/changes',
    ...runtime.countries.map((country) => `https://games28.paulzuiderduin.com/countries/${country.noc}`)
  ];

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${url}</loc></url>`),
    '</urlset>'
  ].join('\n');

  await writeFile(sitemapPath, sitemap + '\n', 'utf8');
  console.log('Synced runtime dataset into public/.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
