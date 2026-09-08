import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeoPages, getSeoPage, seoHeadElements, applySeoPage } from '../../src/lib/seo-pages.js';

const runtime = {
  countries: [{ noc: 'NED', name: 'Netherlands' }, { noc: 'AFG', name: 'Afghanistan' }],
  athleteCards: [{ noc: 'NED', sport: 'Swimming' }], changes: [], meta: {},
  scheduleEntries: [{ id: 'swm-final', sport: 'Swimming', eventName: 'Final', venue: 'Pool', startAtUtc: '2028-07-20T18:00:00Z' }]
};
test('direct and client navigation use identical metadata for every generated page', () => {
  for (const page of buildSeoPages(runtime)) {
    assert.deepEqual(seoHeadElements(getSeoPage(runtime, new URL(page.url).pathname)), seoHeadElements(page));
  }
});
test('country case and trailing slash use the canonical route; missing pages are noindex', () => {
  assert.equal(getSeoPage(runtime, '/countries/ned/').url, 'https://games28.paulzuiderduin.com/countries/NED');
  assert.equal(getSeoPage(runtime, '/countries/XXX').indexable, false);
  assert.equal(getSeoPage(runtime, '/admin').indexable, false);
});
test('only valid session details receive Event data; qualification pages do not', () => {
  assert.ok(getSeoPage(runtime, '/sessions/swm-final').structuredData.some(item => item['@type'] === 'Event'));
  assert.ok(!getSeoPage(runtime, '/countries/NED').structuredData.some(item => item['@type'] === 'Event'));
  const missingVenue = { ...runtime, scheduleEntries: [{ ...runtime.scheduleEntries[0], venue: 'TBD' }] };
  assert.ok(!getSeoPage(missingVenue, '/sessions/swm-final').structuredData.some(item => item['@type'] === 'Event'));
});
test('navigation replaces noindex, titles and JSON-LD instead of accumulating old route tags', () => {
  let nodes = [];
  const doc = {
    head: { querySelectorAll: () => [...nodes], appendChild: node => nodes.push(node) },
    createElement: tag => {
      const node = { tag, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, remove() { nodes = nodes.filter(item => item !== node); } };
      return node;
    }
  };
  for (const route of ['/countries/AFG', '/sessions/swm-final', '/schedule', '/admin', '/']) {
    const page = getSeoPage(runtime, route);
    applySeoPage(page, doc);
    assert.equal(nodes.filter(node => node.tag === 'title').length, 1);
    assert.equal(nodes.find(node => node.tag === 'title').textContent, page.title);
    assert.equal(nodes.find(node => node.attributes.name === 'robots').attributes.content, page.indexable === false ? 'noindex,follow' : 'index,follow');
    assert.equal(nodes.filter(node => node.tag === 'script').length, (page.structuredData || []).length);
  }
});
