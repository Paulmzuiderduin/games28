import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeReviewCandidates, syncReviewCandidates } from '../../scripts/sync-review-candidates-to-supabase.mjs';

const baseUrl = 'https://example.supabase.co';
const key = 'service-role-test-key';
const candidates = [
  {
    id: 'already-approved',
    source_id: 'if-example',
    source_url: 'https://if.example.org/a',
    extracted_evidence: 'Approved evidence',
    reason: 'Official report',
    detected_at: '2026-09-02T00:00:00.000Z'
  },
  {
    id: 'new-candidate',
    source_id: 'if-example',
    source_url: 'https://if.example.org/b',
    extracted_evidence: 'New evidence',
    reason: 'Official report',
    detected_at: '2026-09-02T00:00:00.000Z'
  }
];

test('merges manual and discovered candidates without duplicating a reviewed ID', () => {
  const merged = mergeReviewCandidates(
    [{ id: 'manual-candidate', reason: 'Reviewed research' }, { id: 'shared-candidate', reason: 'Manual source' }],
    [{ id: 'shared-candidate', reason: 'Daily scan' }, { id: 'discovered-candidate', reason: 'Daily scan' }]
  );

  assert.deepEqual(merged, [
    { id: 'manual-candidate', reason: 'Reviewed research' },
    { id: 'shared-candidate', reason: 'Manual source' },
    { id: 'discovered-candidate', reason: 'Daily scan' }
  ]);
});

test('inserts only new review candidates and preserves resolved decisions', async () => {
  const requests = [];
  const result = await syncReviewCandidates({
    candidates,
    supabaseUrl: baseUrl,
    serviceRoleKey: key,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (options.method === 'POST') return new Response(null, { status: 201 });
      return new Response(JSON.stringify([
        { id: 'already-approved', status: 'approved', confirmation_record: { id: 'approved-already-approved' } },
        { id: 'review-later', status: 'review_later', confirmation_record: null }
      ]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });

  assert.deepEqual(result, { insertedCount: 1, restoredApprovalCount: 0, existingCount: 2 });
  assert.equal(requests.filter((request) => request.options.method === 'POST').length, 1);
  assert.deepEqual(
    JSON.parse(requests.find((request) => request.options.method === 'POST').options.body).map((candidate) => candidate.id),
    ['new-candidate']
  );
  assert.equal(requests.some((request) => request.options.method === 'PATCH'), false);
});

test('repairs only a reset approval that still has its confirmation record', async () => {
  const requests = [];
  const result = await syncReviewCandidates({
    candidates: [],
    supabaseUrl: baseUrl,
    serviceRoleKey: key,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (options.method === 'PATCH') return new Response(null, { status: 204 });
      return new Response(JSON.stringify([
        { id: 'reset-approval', status: 'pending', confirmation_record: { id: 'approved-reset-approval' } },
        { id: 'ordinary-pending', status: 'pending', confirmation_record: null }
      ]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });

  assert.deepEqual(result, { insertedCount: 0, restoredApprovalCount: 1, existingCount: 2 });
  const repair = requests.find((request) => request.options.method === 'PATCH');
  assert.match(repair.url, /id=eq\.reset-approval/);
  assert.deepEqual(JSON.parse(repair.options.body), { status: 'approved' });
});
