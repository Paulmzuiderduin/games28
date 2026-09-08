import test from 'node:test';
import assert from 'node:assert/strict';
import { detectChanges } from '../../scripts/update-data.mjs';

test('detectChanges reports initial import when no previous runtime exists', () => {
  const nextRuntime = {
    checkedAt: '2026-04-13T12:00:00.000Z',
    meta: { communityScheduleUrl: 'https://example.com/sheet' },
    athleteCards: [],
    scheduleEntries: [{ id: 'session-1' }]
  };

  const changes = detectChanges(null, nextRuntime);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].changeType, 'initial-import');
});

test('detectChanges reports schedule and qualification deltas', () => {
  const previousRuntime = {
    athleteCards: [
      {
        id: 'athlete-1',
        name: 'Existing athlete',
        noc: 'USA',
        status: 'named',
        state: 'earned',
        lastUpdatedAt: '2026-04-01T00:00:00.000Z'
      }
    ],
    scheduleEntries: [
      {
        id: 'session-1',
        eventName: 'Opening round',
        sessionCode: 'AA1',
        startAtUtc: '2028-07-16T20:00:00.000Z',
        endAtUtc: '2028-07-16T22:00:00.000Z',
        venue: 'Arena',
        sourceUrl: 'https://example.com'
      }
    ]
  };

  const nextRuntime = {
    checkedAt: '2026-04-13T12:00:00.000Z',
    athleteCards: [
      {
        id: 'athlete-1',
        name: 'Existing athlete',
        noc: 'USA',
        status: 'named',
        state: 'selected',
        lastUpdatedAt: '2026-04-11T00:00:00.000Z',
        sourceUrl: 'https://example.com'
      },
      {
        id: 'athlete-2',
        name: 'New quota',
        noc: 'CAN',
        status: 'quota',
        lastUpdatedAt: '2026-04-12T00:00:00.000Z',
        sourceUrl: 'https://example.com'
      }
    ],
    scheduleEntries: [
      {
        id: 'session-1',
        eventName: 'Opening round',
        sessionCode: 'AA1',
        startAtUtc: '2028-07-16T21:00:00.000Z',
        endAtUtc: '2028-07-16T23:00:00.000Z',
        venue: 'Arena',
        sourceUrl: 'https://example.com'
      },
      {
        id: 'session-2',
        eventName: 'Final',
        sessionCode: 'AA2',
        startAtUtc: '2028-07-17T21:00:00.000Z',
        endAtUtc: '2028-07-17T23:00:00.000Z',
        venue: 'Arena',
        sourceUrl: 'https://example.com'
      }
    ]
  };

  const changes = detectChanges(previousRuntime, nextRuntime);
  assert.equal(changes.some((change) => change.changeType === 'schedule-added'), true);
  assert.equal(changes.some((change) => change.changeType === 'schedule-updated'), true);
  assert.equal(changes.some((change) => change.changeType === 'qualification-updated'), true);
  assert.equal(changes.some((change) => change.changeType === 'quota-added'), true);
});

test('detectChanges records when an active qualification card is removed', () => {
  const previousRuntime = {
    athleteCards: [{ id: 'withdrawn-card', noc: 'NED', name: '1 quota place', sourceUrl: 'https://example.com' }],
    scheduleEntries: [],
    changes: []
  };
  const nextRuntime = {
    checkedAt: '2028-07-01T00:00:00.000Z',
    athleteCards: [],
    scheduleEntries: []
  };

  const changes = detectChanges(previousRuntime, nextRuntime);
  assert.equal(changes.some((change) => change.changeType === 'qualification-removed'), true);
});

test('PDF hashes produce one source notice, not false changes for every event', () => {
  const previous = { checkedAt:'2026-09-01',meta:{officialPdfHash:'old'}, athleteCards:[], scheduleEntries:[{id:'one',eventName:'Final',sourcePdfHash:'old'}],changes:[] };
  const next = { ...previous,checkedAt:'2026-09-08',meta:{officialPdfHash:'new'},scheduleEntries:[{...previous.scheduleEntries[0],sourcePdfHash:'new'}] };
  const changes=detectChanges(previous,next);
  assert.deepEqual(changes.map(c=>c.changeType),['schedule-source-updated']);
});
test('removed sessions are recorded and older audit history is retained', () => {
  const previous={athleteCards:[],scheduleEntries:[{id:'removed',eventName:'Final',sessionCode:'A01'}],changes:Array.from({length:90},(_,i)=>({id:String(i),changedAt:'2026-01-01'}))};
  const changes=detectChanges(previous,{athleteCards:[],scheduleEntries:[],checkedAt:'2026-09-08'});
  assert.equal(changes.length,91);
  assert.equal(changes[0].changeType,'schedule-removed');
});
test('qualification check timestamps alone do not create public changes', () => {
  const previous={scheduleEntries:[],athleteCards:[{id:'quota',lastUpdatedAt:'2026-01-01'}]};
  const changes=detectChanges(previous,{scheduleEntries:[],athleteCards:[{id:'quota',lastUpdatedAt:'2026-02-01'}],checkedAt:'2026-02-01'});
  assert.equal(changes.length,0);
});
