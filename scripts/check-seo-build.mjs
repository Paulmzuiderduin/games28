import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { buildSeoPages } from '../src/lib/seo-pages.js';
const runtime = JSON.parse(await readFile('src/data/runtime.json', 'utf8'));
const pages = buildSeoPages(runtime);
const urls = new Set(pages.map(page => page.url));
assert.equal(urls.size, pages.length, 'Duplicate canonical routes');
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1].replace(/&amp;/g, '&'));
assert.deepEqual(sitemapUrls, pages.filter(page => page.indexable !== false).map(page => page.url));
assert.ok(!sitemap.includes('<lastmod>'), 'Do not publish check times as content modification dates');
for (const page of pages) {
  const path = new URL(page.url).pathname;
  assert.ok(path.endsWith('/'));
  const html = await readFile(`dist${path}index.html`, 'utf8');
  for (const pattern of [/<title>/g, /name="description"/g, /name="robots"/g, /rel="canonical"/g, /property="og:title"/g, /name="twitter:title"/g]) {
    assert.equal([...html.matchAll(pattern)].length, 1, `${path}: duplicate or missing ${pattern}`);
  }
  assert.ok(html.includes(`rel="canonical" href="${page.url}"`), path);
  assert.ok(html.includes(`name="robots" content="${page.indexable === false ? 'noindex,follow' : 'index,follow'}"`), path);
  for (const match of html.matchAll(/href="(\/(?:countries|sports|sessions)\/[^"?#]*)"/g)) {
    const target = new URL(match[1], page.url).href;
    assert.ok(urls.has(target), `${path}: link to non-generated route ${target}`);
  }
  for (const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(match[1]);
}
await access('dist/social-card.png');
const png = await readFile('dist/social-card.png');
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);
console.log(`SEO checks passed: ${pages.length} HTML routes, ${sitemapUrls.length} sitemap URLs.`);
