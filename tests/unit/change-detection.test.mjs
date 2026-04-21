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
