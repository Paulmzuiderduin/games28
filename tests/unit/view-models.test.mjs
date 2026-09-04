import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCountryDashboard, buildSportDirectory, buildSportQualificationOverview, filterCountries, filterScheduleEntries } from '../../src/lib/view-models.js';

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

test('buildCountryDashboard shows only explicit sessions and groups entries awaiting a draw', () => {
  const dashboard = buildCountryDashboard(runtime, 'NED');
  assert.equal(dashboard.namedAthletes.length, 1);
  assert.equal(dashboard.quotaPlaces.length, 1);
  assert.equal(dashboard.confirmedSessions.length, 1);
  assert.equal(dashboard.confirmedSessions[0].id, 'row-eight');
  assert.equal(dashboard.awaitingScheduleGroups.length, 1);
  assert.equal(dashboard.awaitingScheduleGroups[0].sport, 'Athletics');
  assert.equal(dashboard.awaitingScheduleGroups[0].entryCount, 1);
  assert.equal(dashboard.stats.awaitingScheduleGroupCount, 1);
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

test('buildSportQualificationOverview groups confirmed records by event and keeps their confirmation state distinct', () => {
  const overview = buildSportQualificationOverview({
    ...runtime,
    athleteCards: [
      ...runtime.athleteCards,
      {
        id: 'usa-marathon-selection',
        noc: 'USA',
        name: 'Alex Runner',
        sport: 'Athletics',
        disciplines: ['Marathon'],
        status: 'named',
        state: 'selected',
        teamType: 'individual',
        lastUpdatedAt: '2026-04-12T00:00:00.000Z'
      }
    ]
  }, 'Athletics');

  assert.equal(overview.stats.countryCount, 2);
  assert.equal(overview.stats.recordCount, 2);
  assert.equal(overview.stats.namedCount, 1);
  assert.equal(overview.stats.quotaCount, 1);
  assert.equal(overview.groups.length, 1);
  assert.equal(overview.groups[0].label, 'Marathon');
  assert.equal(overview.groups[0].countryCount, 2);
  assert.deepEqual(overview.groups[0].cards.map((card) => card.noc), ['USA', 'NED']);
});

test('buildSportDirectory makes every scheduled sport discoverable with qualification counts', () => {
  const sports = buildSportDirectory(runtime);
  const athletics = sports.find((sport) => sport.sport === 'Athletics');
  const rowing = sports.find((sport) => sport.sport === 'Rowing');

  assert.equal(sports.length, 2);
  assert.equal(athletics.sessionCount, 1);
  assert.equal(athletics.qualificationRecordCount, 1);
  assert.equal(athletics.qualificationCountryCount, 1);
  assert.equal(rowing.venueCount, 1);
});

test('sport pages inherit qualification records from their official qualification-system group', () => {
  const groupedRuntime = {
    ...runtime,
    scheduleEntries: [
      { id: 'marathon', sport: 'Athletics (Marathon)', venue: 'Road' },
      { id: 'track', sport: 'Athletics (Track & Field)', venue: 'Stadium' }
    ],
    athleteCards: [{
      id: 'athletics-quota',
      noc: 'NED',
      name: '1 quota place',
      sport: 'Athletics',
      sourceId: 'if-athletics',
      status: 'quota',
      disciplines: ['Track event']
    }],
    meta: {
      qualificationSources: [{
        id: 'if-athletics',
        sport: 'Athletics',
        sports: ['Athletics (Marathon)', 'Athletics (Track & Field)']
      }]
    }
  };

  const directory = buildSportDirectory(groupedRuntime);
  const overview = buildSportQualificationOverview(groupedRuntime, 'Athletics (Track & Field)');

  assert.equal(directory.find((sport) => sport.sport === 'Athletics (Marathon)').qualificationRecordCount, 1);
  assert.equal(overview.stats.recordCount, 1);
  assert.equal(overview.groups[0].cards[0].id, 'athletics-quota');
});

test('sport pages keep related qualification-system sports separate and normalize beach volleyball event labels', () => {
  const volleyballRuntime = {
    countries: runtime.countries,
    athleteCards: [
      {
        id: 'can-indoor', noc: 'USA', name: '1 team quota place', sport: 'Volleyball',
        sourceId: 'if-volleyball', disciplines: ["Women's tournament"], status: 'quota'
      },
      {
        id: 'ned-beach', noc: 'NED', name: 'Beach pair', sport: 'Beach Volleyball',
        sourceId: 'noc-ned-beach', disciplines: ["Women's beach volleyball"], status: 'named'
      }
    ],
    meta: {
      qualificationSources: [
        {
          id: 'if-volleyball', sport: 'Volleyball', sports: ['Beach Volleyball', 'Volleyball'],
          qualificationEvents: [
            { label: "Beach Volleyball - Women's tournament", sports: ['Beach Volleyball'] },
            { label: "Volleyball - Women's tournament", sports: ['Volleyball'] }
          ]
        },
        { id: 'noc-ned-beach', sport: 'Beach Volleyball', sports: ['Beach Volleyball'] }
      ]
    }
  };

  const beachOverview = buildSportQualificationOverview(volleyballRuntime, 'Beach Volleyball');
  const indoorOverview = buildSportQualificationOverview(volleyballRuntime, 'Volleyball');

  assert.deepEqual(beachOverview.cards.map((card) => card.id), ['ned-beach']);
  assert.equal(beachOverview.groups[0].label, "Women's tournament");
  assert.deepEqual(indoorOverview.cards.map((card) => card.id), ['can-indoor']);
});
