import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQualificationPipeline,
  normalizeQualificationRecords,
  toQualificationCards
} from '../../scripts/qualification-records.mjs';

const sources = [{
  id: 'if-example',
  sourceTier: 'if',
  sport: 'Cycling',
  allocationUrl: 'https://example.org/la28-allocations'
}];

function record(overrides = {}) {
  return {
    id: 'ned-cycling-quota',
    noc: 'NED',
    sport: 'Cycling',
    disciplines: ['Road'],
    subjectType: 'noc_quota',
    state: 'allocated',
    quotaCount: 2,
    qualificationRoute: 'official allocation',
    sourceId: 'if-example',
    sourcePublishedAt: '2027-10-10T00:00:00.000Z',
    verifiedAt: '2027-10-11T00:00:00.000Z',
    ...overrides
  };
}

test('normalizes confirmed quota and named qualification records', () => {
  const result = normalizeQualificationRecords([
    record(),
    record({
      id: 'ned-cyclist',
      subjectType: 'athlete',
      state: 'selected',
      athleteName: 'Example Rider',
      quotaCount: null,
      sourcePublishedAt: '2028-06-01T00:00:00.000Z',
      verifiedAt: '2028-06-01T06:00:00.000Z'
    })
  ], sources);

  assert.equal(result.rejected.length, 0);
  const cards = toQualificationCards(result.records);
  assert.equal(cards[0].status, 'quota');
  assert.equal(cards[1].state, 'selected');
  assert.equal(cards[1].name, 'Example Rider');
});

test('keeps an unnamed country team quota distinct from a named team', () => {
  const result = normalizeQualificationRecords([
    record({
      id: 'ger-dressage-team-quota',
      sport: 'Equestrian',
      disciplines: ['Dressage - Team'],
      subjectType: 'team_quota',
      state: 'allocated',
      quotaCount: 1,
      teamSizeMax: 3
    })
  ], sources);

  assert.equal(result.rejected.length, 0);
  const [card] = toQualificationCards(result.records);
  assert.equal(card.status, 'quota');
  assert.equal(card.teamType, 'team');
  assert.equal(card.name, '1 team quota place');
  assert.equal(card.teamSizeMax, 3);
});

test('rejects predictions, untrusted sources, and undated records', () => {
  const result = normalizeQualificationRecords([
    record({
      id: 'prediction',
      subjectType: 'athlete',
      state: 'predicted',
      athleteName: 'No Guessing',
      quotaCount: null,
      sourceTier: 'media',
      sourceUrl: 'https://example.net/article',
      sourcePublishedAt: null,
      verifiedAt: null
    }),
    record({
      id: 'unconfirmed-name',
      subjectType: 'athlete',
      athleteName: null,
      quotaCount: null
    })
  ], sources);

  assert.equal(result.records.length, 0);
  assert.equal(result.rejected.length, 2);
});

test('keeps lifecycle history but publishes the strongest active record', () => {
  const result = buildQualificationPipeline({
    structuredRecords: [
      record({ id: 'quota', recordKey: 'ned-cycling-road', state: 'allocated' }),
      record({ id: 'selected', recordKey: 'ned-cycling-road', subjectType: 'athlete', athleteName: 'Example Rider', quotaCount: null, state: 'selected', verifiedAt: '2028-06-01T00:00:00.000Z' }),
      record({ id: 'entered', recordKey: 'ned-cycling-road', subjectType: 'athlete', athleteName: 'Example Rider', quotaCount: null, state: 'entered', supersedesId: 'selected', verifiedAt: '2028-07-01T00:00:00.000Z' }),
      record({ id: 'withdrawn', recordKey: 'ned-cycling-withdrawn', state: 'withdrawn', quotaCount: null })
    ]
  }, sources);

  assert.equal(result.history.length, 4);
  assert.equal(result.activeRecords.length, 1);
  assert.equal(result.activeRecords[0].id, 'entered');
});

test('queues prose evidence until a reviewer approves a valid confirmation record', () => {
  const result = buildQualificationPipeline({
    reviewQueue: [
      {
        id: 'official-news',
        resolution: 'pending',
        detectedAt: '2028-05-01T00:00:00.000Z',
        sourceUrl: 'https://example.org/news',
        extractedEvidence: 'The federation announced a selection.',
        reason: 'Official prose requires human confirmation.'
      },
      {
        id: 'approved-news',
        resolution: 'approved',
        detectedAt: '2028-06-01T00:00:00.000Z',
        sourceUrl: 'https://example.org/news-2',
        extractedEvidence: 'The NOC named Example Rider.',
        reason: 'Approved by reviewer.',
        record: record({ id: 'approved-rider', subjectType: 'athlete', athleteName: 'Example Rider', quotaCount: null, state: 'selected' })
      }
    ]
  }, sources);

  assert.equal(result.reviewQueue.length, 2);
  assert.equal(result.activeRecords.length, 1);
  assert.equal(result.activeRecords[0].id, 'approved-rider');
});
