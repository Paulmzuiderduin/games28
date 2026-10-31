import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEntryLists } from '../../scripts/schedule-entry-lists.mjs';
import { buildCountryDashboard } from '../../src/lib/view-models.js';

const countries = [
  { noc: 'NED', name: 'Netherlands' },
  { noc: 'USA', name: 'United States' }
];
const scheduleEntries = [
  {
    id: 'swm01-a',
    sessionCode: 'SWM01',
    sport: 'Swimming',
    eventName: '100m Freestyle',
    discipline: '100m Freestyle',
    nocs: [],
    athleteIds: []
  },
  {
    id: 'swm01-b',
    sessionCode: 'SWM01',
    sport: 'Swimming',
    eventName: '200m Freestyle',
    discipline: '200m Freestyle',
    nocs: [],
    athleteIds: []
  },
  {
    id: 'swm02',
    sessionCode: 'SWM02',
    sport: 'Swimming',
    eventName: '100m Butterfly',
    discipline: '100m Butterfly',
    nocs: [],
    athleteIds: []
  }
];

const record = (overrides = {}) => ({
  id: 'draw-swm01',
  sessionCode: 'SWM01',
  nocs: ['NED'],
  publishedAt: '2028-07-10T00:00:00.000Z',
  sourceUrl: 'https://official.example/draws/swm01',
  ...overrides
});

test('verified official draws populate schedule NOCs and athlete IDs', () => {
  const result = applyEntryLists(scheduleEntries, { entries: [record({ athleteIds: ['card-1'] })] }, { countries });
  assert.deepEqual(result.rejected, []);
  assert.equal(result.appliedCount, 2);
  assert.deepEqual(result.scheduleEntries[0].nocs, ['NED']);
  assert.deepEqual(result.scheduleEntries[0].athleteIds, ['card-1']);
  assert.deepEqual(result.scheduleEntries[1].nocs, ['NED']);
  assert.deepEqual(result.scheduleEntries[2].nocs, []);
  assert.deepEqual(scheduleEntries[0].nocs, [], 'input schedule must not be mutated');
});

test('country dashboards derive confirmed sessions from entry-list NOCs', () => {
  const result = applyEntryLists(
    scheduleEntries,
    {
      entries: [
        record({ nocs: ['NED', 'USA'] }),
        record({
          id: 'draw-swm02',
          sessionCode: 'SWM02',
          nocs: ['NED'],
          publishedAt: '2028-07-11T00:00:00.000Z',
          sourceUrl: 'https://official.example/draws/swm02'
        })
      ]
    },
    { countries }
  );
  const runtime = {
    countries,
    athleteCards: [],
    scheduleEntries: result.scheduleEntries,
    changes: [],
    checkedAt: '2028-07-12T00:00:00.000Z',
    countrySelectionRegistry: []
  };
  const dashboard = buildCountryDashboard(runtime, 'NED');
  assert.equal(dashboard.confirmedSessions.length, 3);
  assert.equal(dashboard.stats.confirmedSessionCount, 2);
});

test('event-name and explicit schedule IDs narrow an entry-list record', () => {
  const eventScoped = applyEntryLists(
    scheduleEntries,
    {
      entries: [record({ eventName: '200m Freestyle' })]
    },
    { countries }
  );
  assert.deepEqual(
    eventScoped.scheduleEntries.map((entry) => entry.nocs),
    [[], ['NED'], []]
  );

  const idScoped = applyEntryLists(
    scheduleEntries,
    {
      entries: [record({ sessionCode: undefined, scheduleEntryIds: ['swm02'] })]
    },
    { countries }
  );
  assert.deepEqual(
    idScoped.scheduleEntries.map((entry) => entry.nocs),
    [[], [], ['NED']]
  );
});

test('entry-list records fail closed on unsafe or ambiguous data', () => {
  for (const invalid of [
    record({ sourceUrl: 'http://official.example/draw' }),
    record({ publishedAt: 'not-a-date' }),
    record({ nocs: ['XXX'] }),
    record({ nocs: [] }),
    record({ sessionCode: 'NOPE' }),
    record({ sessionCode: undefined, scheduleEntryIds: ['missing'] })
  ]) {
    const result = applyEntryLists(scheduleEntries, { entries: [invalid] }, { countries });
    assert.equal(result.appliedCount, 0);
    assert.equal(result.rejected.length, 1);
  }
});

test('existing NOC links and athlete links are unioned without duplicates', () => {
  const withExisting = scheduleEntries.map((entry, index) => ({
    ...entry,
    nocs: index === 0 ? ['USA'] : [],
    athleteIds: index === 0 ? ['existing'] : []
  }));
  const result = applyEntryLists(
    withExisting,
    {
      entries: [record({ nocs: ['USA', 'NED', 'NED'], athleteIds: ['existing', 'new'] })]
    },
    { countries }
  );
  assert.deepEqual(result.scheduleEntries[0].nocs, ['NED', 'USA']);
  assert.deepEqual(result.scheduleEntries[0].athleteIds, ['existing', 'new']);
});
