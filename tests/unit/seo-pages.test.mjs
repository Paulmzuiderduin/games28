import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeoPages, getSeoPage, seoHeadElements, applySeoPage } from '../../src/lib/seo-pages.js';

const runtime = {
  countries: [{ noc: 'NED', name: 'Netherlands' }, { noc: 'AFG', name: 'Afghanistan' }],
  athleteCards: [{ noc: 'NED', sport: 'Swimming' }], changes: [], meta: {},
  scheduleEntries: [{ id: 'swm-final', sport: 'Swimming', eventName: 'Final', venue: 'Galen Center', startAtUtc: '2028-07-20T18:00:00Z' }]
};
test('direct and client navigation use identical metadata for every generated page', () => {
  for (const page of buildSeoPages(runtime)) {
    assert.deepEqual(seoHeadElements(getSeoPage(runtime, new URL(page.url).pathname)), seoHeadElements(page));
  }
});
test('country case and trailing slash use the canonical route; missing pages are noindex', () => {
  assert.equal(getSeoPage(runtime, '/countries/ned/').url, 'https://games28.paulzuiderduin.com/countries/NED/');
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

test('Event requires a verified venue and time; cancelled events retain honest metadata', () => {
  const event = overrides => getSeoPage({ ...runtime, scheduleEntries: [{ ...runtime.scheduleEntries[0], ...overrides }] }, '/sessions/swm-final').structuredData.find(item => item['@type'] === 'Event');
  for (const venue of ['Pool', 'Unknown', '', '2028 Stadium']) assert.equal(event({ venue }), undefined);
  assert.equal(event({ startAtUtc: 'invalid' }), undefined);
  const data = event({ status: 'cancelled', endAtUtc: 'invalid' });
  assert.equal(data.eventStatus, 'https://schema.org/EventCancelled');
  assert.equal(data.organizer.name, 'LA28');
  assert.equal(data.location.address.postalCode, '90089');
  for (const field of ['offers', 'performer', 'image', 'endDate']) assert.equal(data[field], undefined);
});

test('static qualifications keep linked athletes and source evidence without a duplicate quota row', () => {
  const quota = { id: 'q', noc: 'NED', sport: 'Swimming', status: 'quota', state: 'allocated', subjectType: 'noc_quota', quotaCount: 1, disciplines: ['100m'], sourceUrl: 'https://example.org/quota' };
  const athlete = { id: 'a', noc: 'NED', sport: 'Swimming', status: 'named', state: 'selected', subjectType: 'athlete', name: 'Example Swimmer', athleteName: 'Example Swimmer', disciplines: ['100m'], allocationRecordId: 'q', sourceUrl: 'https://example.org/selection' };
  const data = { ...runtime, athleteCards: [quota, athlete] };
  const page = getSeoPage(data, '/countries/NED/');
  const rows = page.sections.flatMap(section => section.items);
  assert.equal(rows.length, 1);
  assert.match(rows[0].text, /Example Swimmer/);
  assert.doesNotMatch(rows[0].text, /not yet selected/);
  assert.ok(rows[0].links.some(link => link.href === athlete.sourceUrl));
  assert.deepEqual(getSeoPage(data, '/countries/AFG/').sections, []);
});
