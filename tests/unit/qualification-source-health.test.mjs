import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveQualificationSourceHealth, preserveUnavailableIngestion } from '../../scripts/update-data.mjs';

test('a failed qualification source check reports failure while retaining the last successful check timestamp', () => {
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

  assert.equal(result[0].available, false);
  assert.equal(result[0].httpStatus, null);
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

test('HTTP 200 parse failures and truncation retain last-good records without accepting partial rows', () => {
  const previous = { structuredRecords: [{ id: 'good', sourceId: 'if-example' }] };
  for (const scan of [{ dataValidated: false }, { dataValidated: true, truncated: true }]) {
    const result = preserveUnavailableIngestion({
      sourceChecks: [{ id: 'if-example', available: true }],
      scans: [{ sourceId: 'if-example', ...scan }],
      structuredRecords: [{ id: 'partial', sourceId: 'if-example' }], reviewQueue: []
    }, previous);
    assert.deepEqual(result.structuredRecords, previous.structuredRecords);
  }
});
test('a validated feed omission is not treated as an official withdrawal', () => {
  const result = preserveUnavailableIngestion({
    sourceChecks: [{ id: 'if-example', available: true }],
    scans: [{ sourceId: 'if-example', dataValidated: true }],
    structuredRecords: [{ id: 'new', sourceId: 'if-example' }], reviewQueue: []
  }, { structuredRecords: [{ id: 'existing', sourceId: 'if-example' }] });
  assert.deepEqual(result.structuredRecords.map(record => record.id), ['existing', 'new']);
});

test('repeated failures keep the original last-success timestamp without hiding current failures', () => {
  const first = preserveQualificationSourceHealth([{ id: 'source', available: false, checkedAt: '2028-01-02', httpStatus: 503 }], [{ id: 'source', available: true, checkedAt: '2028-01-01' }]);
  const second = preserveQualificationSourceHealth([{ id: 'source', available: false, checkedAt: '2028-01-03', httpStatus: 502 }], first);
  assert.equal(second[0].lastSuccessfulAt, '2028-01-01');
  assert.equal(second[0].httpStatus, 502);
  assert.equal(second[0].available, false);
  const recovered = preserveQualificationSourceHealth([{ id: 'source', available: true, checkedAt: '2028-01-04', httpStatus: 200 }], second);
  assert.equal(recovered[0].lastSuccessfulAt, '2028-01-04');
  assert.equal(recovered[0].healthCheckFailedAt, null);
});
