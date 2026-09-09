import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchTargets,
  candidatesFromSearchResults,
  discoverQualificationSearch,
  selectDailyTargets
} from '../../scripts/discover-qualification-search.mjs';

const sources = [{
  id: 'if-volleyball',
  qualificationSystemKey: 'volleyball',
  label: 'FIVB - Volleyball',
  sport: 'Volleyball',
  url: 'https://www.fivb.com/qualification',
  qualificationEvents: [
    { key: 'indoor-women', label: "Volleyball - Women's tournament", sports: ['Volleyball'] },
    { key: 'indoor-men', label: "Volleyball - Men's tournament", sports: ['Volleyball'] }
  ]
}];
const countries = [{ noc: 'NED', name: 'Netherlands' }, { noc: 'THA', name: 'Thailand' }];

test('builds rotating sport-event search targets on the trusted official host', () => {
  const targets = buildSearchTargets(sources);
  assert.equal(targets.length, 2);
  assert.equal(targets[0].trustedHost, 'fivb.com');
  assert.equal(targets[0].canonicalEventKey, 'volleyball:indoor-men');
  assert.deepEqual(selectDailyTargets(targets, '2026-09-05T00:00:00.000Z', 1).length, 1);
});

test('keeps additional quota evidence and selection discovery separate', () => {
  const target = buildSearchTargets(sources).find((entry) => entry.eventKey === 'indoor-women');
  const result = [{
    url: 'https://www.fivb.com/thailand-qualified',
    title: 'Thailand secure LA28 volleyball quota',
    description: "Thailand qualified for the LA28 Women's tournament."
  }];
  const records = [{
    noc: 'THA',
    canonicalEventKey: 'volleyball:indoor-women',
    subjectType: 'team_quota',
    state: 'allocated'
  }];
  const allocation = candidatesFromSearchResults({ target, results: result, countries, qualificationRecords: records, checkedAt: '2026-09-05T00:00:00.000Z' });
  assert.equal(allocation.candidates.length, 1);
  assert.equal(allocation.suppressedKnownQuotaCount, 0);

  const selection = candidatesFromSearchResults({
    target,
    results: [{ ...result[0], title: 'Thailand names volleyball team for LA28', description: "Thailand selected its Women's tournament roster for LA28." }],
    countries,
    qualificationRecords: records,
    checkedAt: '2026-09-05T00:00:00.000Z'
  });
  assert.equal(selection.candidates.length, 1);
  assert.match(selection.candidates[0].id, /tha-selection$/);
});

test('keeps distinct official articles as separate review candidates', async () => {
  const target = buildSearchTargets(sources).find((entry) => entry.eventKey === 'indoor-women');
  const first = candidatesFromSearchResults({
    target,
    results: [{ url: 'https://www.fivb.com/article-one', title: 'Thailand qualified for LA28', description: "Thailand earned a Women's tournament quota." }],
    countries,
    qualificationRecords: [],
    checkedAt: '2026-09-05T00:00:00.000Z'
  }).candidates[0];
  const second = candidatesFromSearchResults({
    target,
    results: [{ url: 'https://www.fivb.com/article-two', title: 'Thailand LA28 quota confirmed', description: "Thailand secured a Women's tournament quota." }],
    countries,
    qualificationRecords: [],
    checkedAt: '2026-09-06T00:00:00.000Z'
  }).candidates[0];
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.sourceUrl, second.sourceUrl);

  const discovery = await discoverQualificationSearch({
    apiKey: 'test-key',
    sources,
    countries,
    qualificationRecords: [],
    checkedAt: '2026-09-05T00:00:00.000Z',
    maxQueries: 1,
    fetchImpl: async () => new Response(JSON.stringify({ web: { results: [{ url: 'https://www.fivb.com/article-one', title: 'Thailand qualified for LA28', description: "Thailand earned a Women's tournament quota." }] } }), { status: 200 })
  });
  assert.equal(discovery.queryCount, 1);
  assert.equal(discovery.candidates.length, 1);
});

test('same article updates keep their identity and tracking parameters do not create duplicates', () => {
  const target = buildSearchTargets(sources)[0];
  const make = (url, title) => candidatesFromSearchResults({ target, results: [{ url, title }], countries, qualificationRecords: [], checkedAt: '2026-09-09' }).candidates[0];
  const first = make('https://www.fivb.com/announcement?utm_source=test', 'Thailand qualified for LA28');
  const updated = make('https://www.fivb.com/announcement', 'Thailand qualified for LA28 with two places');
  assert.ok(first);
  assert.equal(first.id, updated.id);
  assert.notEqual(first.discovery.evidenceHash, updated.discovery.evidenceHash);
});

test('rotation advances by a complete daily batch', () => {
  const targets = Array.from({ length: 48 }, (_, id) => ({ id }));
  const first = selectDailyTargets(targets, '2026-09-08', 24);
  const second = selectDailyTargets(targets, '2026-09-09', 24);
  assert.equal(new Set([...first, ...second].map((target) => target.id)).size, 48);
});

test('disabled search makes no requests', async () => {
  const result = await discoverQualificationSearch({ sources, countries, qualificationRecords: [], checkedAt: '2026-09-09', fetchImpl: () => { throw new Error('Must not fetch'); } });
  assert.equal(result.enabled, false);
  assert.equal(result.queryCount, 0);
});
