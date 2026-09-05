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

test('sync accepts a manually researched candidate whose source is pre-filled for approval', async () => {
  let posted = null;
  await syncReviewCandidates({
    candidates: [{
      id: 'manual-candidate',
      sourceUrl: 'https://if.example.org/official-announcement',
      extractedEvidence: 'Official confirmation.',
      reason: 'Review this official source.',
      detectedAt: '2026-09-03T00:00:00.000Z',
      suggestedRecord: { sourceId: 'if-example' }
    }],
    supabaseUrl: baseUrl,
    serviceRoleKey: key,
    fetchImpl: async (url, options = {}) => {
      if (options.method === 'POST') {
        posted = JSON.parse(options.body);
        return new Response(null, { status: 201 });
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });

  assert.equal(posted[0].source_id, 'if-example');
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

  assert.deepEqual(result, { insertedCount: 1, updatedEvidenceCount: 0, restoredApprovalCount: 0, existingCount: 2 });
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

  assert.deepEqual(result, { insertedCount: 0, updatedEvidenceCount: 0, restoredApprovalCount: 1, existingCount: 2 });
  const repair = requests.find((request) => request.options.method === 'PATCH');
  assert.match(repair.url, /id=eq\.reset-approval/);
  assert.deepEqual(JSON.parse(repair.options.body), { status: 'approved' });
});

test('updates changed search evidence in place without reopening a review', async () => {
  const requests = [];
  const result = await syncReviewCandidates({
    candidates: [{
      id: 'review-search-if-example-event-ned-allocation',
      sourceId: 'if-example',
      sourceUrl: 'https://if.example.org/new-announcement',
      extractedEvidence: 'Updated official evidence.',
      reason: 'Official web discovery found a possible allocation.',
      detectedAt: '2026-09-05T00:00:00.000Z'
    }],
    supabaseUrl: baseUrl,
    serviceRoleKey: key,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (options.method === 'PATCH') return new Response(null, { status: 204 });
      return new Response(JSON.stringify([{
        id: 'review-search-if-example-event-ned-allocation',
        status: 'review_later',
        confirmation_record: null,
        source_url: 'https://if.example.org/old-announcement',
        extracted_evidence: 'Older official evidence.',
        reason: 'Official web discovery found a possible allocation.',
        suggested_record: null
      }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });

  assert.deepEqual(result, { insertedCount: 0, updatedEvidenceCount: 1, restoredApprovalCount: 0, existingCount: 1 });
  const update = requests.find((request) => request.options.method === 'PATCH');
  assert.match(update.url, /review-search-if-example-event-ned-allocation/);
  assert.equal(JSON.parse(update.options.body).source_url, 'https://if.example.org/new-announcement');
  assert.equal(JSON.parse(update.options.body).status, undefined);
});
