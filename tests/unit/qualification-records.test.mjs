import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQualificationRecords, toQualificationCards } from '../../scripts/qualification-records.mjs';

const source = {
  sources: [
    {
      id: 'if-example',
      sourceTier: 'if',
      url: 'https://example.org/la28-allocations'
    }
  ],
  records: [
    {
      id: 'ned-cycling-quota',
      noc: 'NED',
      sport: 'Cycling',
      disciplines: ['Road'],
      subjectType: 'noc_quota',
      state: 'allocated',
      quotaCount: 2,
      qualificationRoute: 'ranking',
      sourceId: 'if-example',
      sourcePublishedAt: '2027-10-10T00:00:00.000Z',
      verifiedAt: '2027-10-11T00:00:00.000Z'
    },
    {
      id: 'ned-cyclist',
      noc: 'NED',
      sport: 'Cycling',
      subjectType: 'athlete',
      state: 'selected',
      athleteName: 'Example Rider',
      sourceId: 'if-example',
      sourcePublishedAt: '2028-06-01T00:00:00.000Z',
      verifiedAt: '2028-06-01T06:00:00.000Z'
    }
  ]
};

test('normalizes confirmed quota and named qualification records', () => {
  const result = normalizeQualificationRecords(source);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.records.length, 2);

  const cards = toQualificationCards(result.records);
  assert.equal(cards[0].status, 'quota');
  assert.equal(cards[0].quotaCount, 2);
  assert.equal(cards[1].status, 'named');
  assert.equal(cards[1].state, 'selected');
  assert.equal(cards[1].name, 'Example Rider');
});

test('rejects predictions, untrusted sources, and undated records', () => {
  const result = normalizeQualificationRecords({
    ...source,
    records: [
      {
        id: 'prediction',
        noc: 'NED',
        sport: 'Cycling',
        subjectType: 'athlete',
        state: 'predicted',
        athleteName: 'No Guessing',
        sourceTier: 'media',
        sourceUrl: 'https://example.net/article'
      },
      {
        id: 'unconfirmed-name',
        noc: 'NED',
        sport: 'Cycling',
        subjectType: 'athlete',
        state: 'allocated',
        sourceId: 'if-example',
        sourcePublishedAt: '2028-06-01T00:00:00.000Z',
        verifiedAt: '2028-06-01T00:00:00.000Z'
      }
    ]
  });

  assert.equal(result.records.length, 0);
  assert.equal(result.rejected.length, 2);
});

test('rejects withdrawn records from the published dataset', () => {
  const result = normalizeQualificationRecords({
    ...source,
    records: [{
      id: 'withdrawn-place',
      noc: 'NED',
      sport: 'Cycling',
      subjectType: 'noc_quota',
      state: 'withdrawn',
      quotaCount: 1,
      sourceId: 'if-example',
      sourcePublishedAt: '2028-06-01T00:00:00.000Z',
      verifiedAt: '2028-06-01T00:00:00.000Z'
    }]
  });

  assert.equal(result.records.length, 0);
  assert.match(result.rejected[0].problems.join(' '), /not publishable/);
});
