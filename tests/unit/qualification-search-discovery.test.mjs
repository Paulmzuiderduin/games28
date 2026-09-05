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

test('suppresses an already-known quota but keeps selection discovery separate', () => {
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
  assert.equal(allocation.candidates.length, 0);
  assert.equal(allocation.suppressedKnownQuotaCount, 1);

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

test('keeps a source update on the same stable review candidate', async () => {
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
  assert.equal(first.id, second.id);
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
