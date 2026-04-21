import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCountryDashboard, filterCountries, filterScheduleEntries } from '../../src/lib/view-models.js';

const runtime = {
  checkedAt: '2026-04-13T12:00:00.000Z',
  countries: [
    { noc: 'NED', name: 'Netherlands', flag: 'NED', continent: 'Europe', profileSlug: 'netherlands' },
    { noc: 'USA', name: 'United States', flag: 'USA', continent: 'North America', profileSlug: 'united-states' }
  ],
  athleteCards: [
    {
      id: 'ned-marathon',
      noc: 'NED',
      name: 'Women Marathon quota place',
      sport: 'Athletics',
      disciplines: ['Marathon'],
      scheduleHints: ['marathon'],
      status: 'quota',
      teamType: 'individual',
      lastUpdatedAt: '2026-04-10T00:00:00.000Z'
    },
    {
      id: 'ned-rowing-eight',
      noc: 'NED',
      name: 'Women Eight',
      sport: 'Rowing',
      disciplines: ['Eight'],
      scheduleHints: ['eight'],
      status: 'named',
      teamType: 'team',
      lastUpdatedAt: '2026-04-11T00:00:00.000Z'
    }
  ],
  scheduleEntries: [
    {
      id: 'ath-marathon',
      sport: 'Athletics',
      discipline: 'Marathon',
      eventName: "Women's Marathon",
      phase: 'Final',
      startAtUtc: '2028-07-29T13:00:00.000Z',
      sourceUrl: 'https://example.com',
      venue: 'Stadium',
      status: 'scheduled',
      nocs: [],
      athleteIds: []
    },
    {
      id: 'row-eight',
      sport: 'Rowing',
      discipline: 'Eight',
      eventName: "Women's Eight Final",
      phase: 'Final',
      startAtUtc: '2028-07-30T13:00:00.000Z',
      sourceUrl: 'https://example.com',
      venue: 'Lake',
      status: 'scheduled',
      nocs: ['NED'],
      athleteIds: []
    }
  ],
  changes: [
    {
      id: 'change-1',
      entityId: 'ned-rowing-eight',
      entityType: 'athlete_card',
      changeType: 'named-athlete-added',
      changedAt: '2026-04-11T00:00:00.000Z',
      noc: 'NED',
      sourceUrl: 'https://example.com',
      summary: 'NED qualification update'
    }
  ]
};

test('buildCountryDashboard separates confirmed and pending schedule matches', () => {
  const dashboard = buildCountryDashboard(runtime, 'NED');
  assert.equal(dashboard.namedAthletes.length, 1);
  assert.equal(dashboard.quotaPlaces.length, 1);
  assert.equal(dashboard.confirmedSessions.length, 1);
  assert.equal(dashboard.pendingSessions.length, 1);
  assert.equal(dashboard.confirmedSessions[0].id, 'row-eight');
  assert.equal(dashboard.pendingSessions[0].id, 'ath-marathon');
  assert.equal(dashboard.changes.length, 1);
});

test('filterScheduleEntries respects sport, date, and text filters', () => {
  const filtered = filterScheduleEntries(
    [
      { id: '1', sport: 'Athletics', eventName: 'Marathon', phase: 'Final', venue: 'Stadium', sessionCode: 'A1', dayKey: '2028-07-29' },
      { id: '2', sport: 'Rowing', eventName: 'Eight', phase: 'Heat', venue: 'Lake', sessionCode: 'R2', dayKey: '2028-07-30' }
    ],
    { sport: 'Athletics', dayKey: '2028-07-29', searchText: 'marathon' }
  );
  assert.deepEqual(filtered.map((entry) => entry.id), ['1']);
});

test('filterCountries prioritizes favorites and search', () => {
  const filtered = filterCountries(runtime.countries, runtime.athleteCards, {
    searchText: 'nether',
    favoriteOnly: false,
    favorites: ['USA']
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].noc, 'NED');
});
