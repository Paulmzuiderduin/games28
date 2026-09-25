import { getSportGroup } from '../src/lib/sport-groups.js';
import { publicRuntime, publicIngestion } from './public-dataset.mjs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, writeFile } from 'node:fs/promises';
import { readJson, stableStringify } from './dataset-utils.mjs';
import { buildSeoPages } from '../src/lib/seo-pages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const publicDir = resolve(rootDir, 'public');
const runtimePath = resolve(rootDir, 'src/data/runtime.json');
const sourceCheckPath = resolve(rootDir, 'src/data/source-check.json');
const qualificationIngestionPath = resolve(rootDir, 'src/data/qualification-ingestion.json');
const publicRuntimePath = resolve(publicDir, 'runtime.json');
const publicMetaPath = resolve(publicDir, 'runtime.meta.json');
const sitemapPath = resolve(publicDir, 'sitemap.xml');

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function main() {
  await ensureDir(publicDir);
  await copyFile(sourceCheckPath, resolve(publicDir, 'source-check.json'));

  const runtime = await readJson(runtimePath, null);
  if (!runtime) {
    throw new Error('Missing runtime dataset. Run npm run data:update first.');
  }
  await writeFile(publicRuntimePath, stableStringify(publicRuntime(runtime)) + '\n');
  const ingestion = await readJson(qualificationIngestionPath, {});
  await writeFile(resolve(publicDir, 'qualification-ingestion.json'), stableStringify(publicIngestion(ingestion)) + '\n');

  const meta = {
    checkedAt: runtime.checkedAt,
    countryCount: runtime.meta.countryCount,
    lastChangedAt: runtime.meta.lastChangedAt,
    qualificationCount: runtime.meta.qualificationCount,
    qualificationPolicy: runtime.meta.qualificationPolicy,
    qualificationRecordCount: runtime.meta.qualificationRecordCount,
    qualificationReviewCount: runtime.meta.qualificationReviewCount,
    qualificationAutoRecordCount: runtime.meta.qualificationAutoRecordCount,
    qualificationSourceScanCount: runtime.meta.qualificationSourceScanCount,
    qualificationReferenceSourceCount: runtime.meta.qualificationReferenceSourceCount,
    iocQualificationRules: runtime.meta.iocQualificationRules,
    qualificationCoverage: runtime.meta.qualificationCoverage,
    countrySelectionCoverage: runtime.meta.countrySelectionCoverage,
    scheduleCount: runtime.meta.scheduleCount,
    sportCount: runtime.meta.sportCount
  };

  await writeFile(publicMetaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  const urls = buildSeoPages(runtime).filter(page => page.indexable !== false).map(page => page.url);

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((path) => `  <url><loc>${escapeXml(path)}</loc></url>`),
    '</urlset>'
  ].join('\n');

  await writeFile(sitemapPath, sitemap + '\n', 'utf8');
  console.log('Synced runtime dataset into public/.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
