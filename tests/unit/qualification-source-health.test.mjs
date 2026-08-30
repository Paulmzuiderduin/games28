import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveQualificationSourceHealth, preserveUnavailableIngestion } from '../../scripts/update-data.mjs';

test('a failed qualification source check preserves the last known good health state', () => {
  const result = preserveQualificationSourceHealth([
    {
      id: 'if-example',
      url: 'https://example.org',
      checkedAt: '2028-01-02T00:00:00.000Z',
      available: false,
      httpStatus: null,
      resolvedUrl: 'https://example.org',
      checkError: 'timeout'
    }
  ], [{
    id: 'if-example',
    checkedAt: '2028-01-01T00:00:00.000Z',
    available: true,
    httpStatus: 200,
    resolvedUrl: 'https://example.org/live'
  }]);

  assert.equal(result[0].available, true);
  assert.equal(result[0].httpStatus, 200);
  assert.equal(result[0].lastSuccessfulAt, '2028-01-01T00:00:00.000Z');
  assert.equal(result[0].healthCheckFailedAt, '2028-01-02T00:00:00.000Z');
});

test('an unavailable source keeps its last structured records and pending review candidates', () => {
  const result = preserveUnavailableIngestion({
    sourceChecks: [{ id: 'if-example', available: false }],
    structuredRecords: [],
    reviewQueue: []
  }, {
    structuredRecords: [{ id: 'quota-1', sourceId: 'if-example', verifiedAt: '2028-01-01T00:00:00.000Z' }],
    reviewQueue: [{ id: 'review-1', sourceId: 'if-example', detectedAt: '2028-01-01T00:00:00.000Z' }]
  });

  assert.equal(result.structuredRecords.length, 1);
  assert.equal(result.reviewQueue.length, 1);
});
