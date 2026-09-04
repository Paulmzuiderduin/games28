import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildQualificationPipeline,
  isPublishableQualificationCard,
  normalizeQualificationRecords,
  toQualificationCards
} from '../../scripts/qualification-records.mjs';
import { buildQualificationSystemIndex, toQualificationSources } from '../../scripts/qualification-systems.mjs';
import { approvedRecordsFromRuntime, retainedApprovedRecords } from '../../scripts/update-data.mjs';

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

test('normalizes qualification aliases to one canonical event identity', () => {
  const volleyballSources = [{
    id: 'if-volleyball', sourceTier: 'if', sport: 'Volleyball',
    allocationUrl: 'https://example.org/la28-allocations',
    qualificationSystemKey: 'volleyball',
    qualificationEvents: [
      { key: 'beach-women', label: "Beach Volleyball - Women's tournament", sports: ['Beach Volleyball'] },
      { key: 'indoor-women', label: "Volleyball - Women's tournament", sports: ['Volleyball'] }
    ]
  }];
  const result = normalizeQualificationRecords([
    record({ id: 'ned-beach', sport: 'Beach Volleyball', disciplines: ["Women's beach volleyball"], sourceId: 'if-volleyball' }),
    record({ id: 'can-indoor', sport: 'Volleyball', disciplines: ["Women's tournament"], sourceId: 'if-volleyball' })
  ], volleyballSources);

  assert.equal(result.rejected.length, 0);
  assert.equal(result.records[0].canonicalEventKey, 'volleyball:beach-women');
  assert.equal(result.records[0].canonicalEventLabel, "Beach Volleyball - Women's tournament");
  assert.equal(result.records[1].canonicalEventKey, 'volleyball:indoor-women');
});

test('rejects a qualified national team incorrectly entered as a named team', () => {
  const result = normalizeQualificationRecords([
    record({
      id: 'aus-cricket-team', sport: 'Cricket', disciplines: ["Women's T20 tournament"],
      subjectType: 'team', state: 'allocated', teamName: "Australia women's cricket team", quotaCount: null
    })
  ], sources);

  assert.equal(result.records.length, 0);
  assert.match(result.rejected[0].problems.join(' '), /allocated places must use a quota record/);
  assert.equal(isPublishableQualificationCard({ subjectType: 'team', state: 'allocated' }), false);
});

test('keeps a country quota visible when a later named athlete is linked to it', () => {
  const result = buildQualificationPipeline({
    structuredRecords: [
      record({ id: 'ned-road-quota', recordKey: 'ned-road-quota', quotaCount: 1 }),
      record({ id: 'ned-rider', recordKey: 'ned-rider', subjectType: 'athlete', athleteName: 'Example Rider', quotaCount: null, state: 'selected', allocationRecordId: 'ned-road-quota' })
    ]
  }, sources);

  assert.equal(result.activeRecords.length, 2);
  const namedCard = toQualificationCards(result.activeRecords).find((card) => card.id === 'ned-rider');
  assert.equal(namedCard.allocationRecordId, 'ned-road-quota');
});

test('retains approved reviews when the private queue is unavailable to a local build', () => {
  const approved = record({ id: 'approved-rider', sourceRecordType: 'review_approved' });
  const structured = record({ id: 'structured-rider', sourceRecordType: 'structured_allocation' });
  assert.deepEqual(approvedRecordsFromRuntime({ qualificationHistory: [approved, structured] }), [approved]);
});

test('only removes an approved review after Supabase explicitly changes its status', () => {
  const approved = record({ id: 'approved-candidate-1', sourceRecordType: 'review_approved' });
  const previousRuntime = { qualificationHistory: [approved] };

  assert.equal(retainedApprovedRecords(previousRuntime, { available: true, statusesById: {} }).length, 1);
  assert.equal(retainedApprovedRecords(previousRuntime, { available: true, statusesById: { 'candidate-1': 'approved' } }).length, 0);
  assert.equal(retainedApprovedRecords(previousRuntime, { available: true, statusesById: { 'candidate-1': 'rejected' } }).length, 0);
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

test('keeps manually discovered official qualifications private but ready for approval', async () => {
  const input = JSON.parse(await readFile(new URL('../../src/data/qualification-sources.source.json', import.meta.url), 'utf8'));
  const runtime = JSON.parse(await readFile(new URL('../../src/data/runtime.json', import.meta.url), 'utf8'));
  const sourceList = toQualificationSources(buildQualificationSystemIndex(runtime.scheduleEntries).systems);
  const pipeline = buildQualificationPipeline({ reviewQueue: input.reviewQueue }, sourceList);
  const recordsToApprove = input.reviewQueue.map((candidate) => ({
    ...candidate.suggestedRecord,
    verifiedAt: candidate.detectedAt
  }));
  const validation = normalizeQualificationRecords(recordsToApprove, sourceList);

  assert.equal(pipeline.activeRecords.length, 0);
  assert.equal(pipeline.reviewQueue.length, 5);
  assert.equal(validation.rejected.length, 0);
});
