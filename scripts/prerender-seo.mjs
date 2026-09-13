import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from './dataset-utils.mjs';
import { canonicalRoutePath, SITE_NAME } from '../src/lib/seo.js';
import { buildSeoPages, seoHeadElements } from '../src/lib/seo-pages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const runtimePath = resolve(rootDir, 'src/data/runtime.json');
const templatePath = resolve(distDir, 'index.html');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHeadElement({ tag, attributes = {}, content }) {
  const attrs = Object.entries(attributes).map(([key, value]) => ` ${key}="${escapeHtml(value)}"`).join('');
  if (tag === 'meta' || tag === 'link') return `<${tag}${attrs} />`;
  return `<${tag}${attrs}>${tag === 'script' ? content : escapeHtml(content)}</${tag}>`;
}

function fallbackHtml(page) {
  const links = (page.links || [])
    .map((link) => `<li><a href="${escapeHtml(link.href.startsWith('/') ? canonicalRoutePath(link.href) : link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join('');
  const facts = (page.facts || [])
    .map((fact) => `<li>${escapeHtml(fact)}</li>`)
    .join('');

  return [
    '<main class="seo-fallback">',
    `<p>${escapeHtml(page.eyebrow || SITE_NAME)}</p>`,
    `<h1>${escapeHtml(page.heading || page.title)}</h1>`,
    `<p>${escapeHtml(page.description)}</p>`,
    facts ? `<ul>${facts}</ul>` : '',
    links ? `<nav aria-label="Related Games28 pages"><ul>${links}</ul></nav>` : '',
    '</main>'
  ].join('');
}

function renderPage(template, page) {
  const head = seoHeadElements(page).map(renderHeadElement).join('\n    ');
  return template
    .replace(/<title>[\s\S]*?<\/title>/, '<!-- SEO_META -->')
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, '')
    .replace(/<meta\s+property="og:[\s\S]*?\/>\s*/g, '')
    .replace(/<meta\s+name="twitter:[\s\S]*?\/>\s*/g, '')
    .replace('<!-- SEO_META -->', head)
    .replace('<div id="root"></div>', `<div id="root">${fallbackHtml(page)}</div>`);
}

async function writeRoute(template, page) {
  const path = new URL(page.url).pathname;
  const filePath = path === '/' ? resolve(distDir, 'index.html') : resolve(distDir, path.slice(1), 'index.html');
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, renderPage(template, page), 'utf8');
}


async function main() {
  const [template, runtime] = await Promise.all([
    readFile(templatePath, 'utf8'),
    readJson(runtimePath, null)
  ]);

  if (!runtime) {
    throw new Error('Missing runtime dataset. Run npm run data:update first.');
  }

  const pages = buildSeoPages(runtime);
  await Promise.all(pages.map((page) => writeRoute(template, page)));
  console.log(`Pre-rendered ${pages.length} SEO routes.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
