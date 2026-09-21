import test from 'node:test';
import assert from 'node:assert/strict';
import { approveReviewCandidates, parseCandidateIds } from '../../scripts/approve-review-candidates.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('parseCandidateIds accepts commas and whitespace without duplicates', () => {
  assert.deepEqual(parseCandidateIds('one, two\none  three'), ['one', 'two', 'three']);
});

test('approves proposed records and verifies the result', async () => {
  let reads = 0;
  const patches = [];
  const fetchImpl = async (_url, options = {}) => {
    if (options.method === 'PATCH') {
      patches.push(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    }
    reads += 1;
    if (reads === 1) return jsonResponse([{ id: 'review-usa', status: 'pending', suggested_record: { id: 'approved-usa', noc: 'USA', sourcePublishedAt: '2026-07-16' }, confirmation_record: null }]);
    if (reads === 2) return jsonResponse([]);
    if (reads === 3) return jsonResponse([{ id: 'review-usa', status: 'approved', confirmation_record: { id: 'approved-usa', noc: 'USA', sourcePublishedAt: '2026-07-16T00:00:00.000Z', verifiedAt: '2026-09-20T12:00:00.000Z' } }]);
    return jsonResponse([]);
  };

  const result = await approveReviewCandidates({
    candidateIds: ['review-usa'],
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'secret',
    fetchImpl,
    now: () => '2026-09-20T12:00:00.000Z'
  });

  assert.deepEqual(result, { approvedCount: 1, repairedCount: 0, alreadyApprovedCount: 0, verifiedCount: 1 });
  assert.equal(patches.length, 1);
  assert.equal(patches[0].status, 'approved');
  assert.deepEqual(patches[0].confirmation_record, {
    id: 'approved-usa',
    noc: 'USA',
    sourcePublishedAt: '2026-07-16T00:00:00.000Z',
    verifiedAt: '2026-09-20T12:00:00.000Z',
    sourceRecordType: 'review_approved'
  });
});

test('repairs an approved record that predates verification timestamps', async () => {
  let reads = 0;
  const patches = [];
  const fetchImpl = async (_url, options = {}) => {
    if (options.method === 'PATCH') {
      patches.push(JSON.parse(options.body));
      return new Response(null, { status: 204 });
    }
    reads += 1;
    if (reads === 1) return jsonResponse([{
      id: 'review-usa',
      status: 'approved',
      suggested_record: { id: 'approved-usa', noc: 'USA', sourcePublishedAt: '2026-07-16' },
      confirmation_record: { id: 'approved-usa', noc: 'USA', sourcePublishedAt: '2026-07-16' }
    }]);
    if (reads === 2) return jsonResponse([]);
    if (reads === 3) return jsonResponse([{ id: 'review-usa', status: 'approved', confirmation_record: patches[0].confirmation_record }]);
    return jsonResponse([]);
  };

  const result = await approveReviewCandidates({
    candidateIds: ['review-usa'],
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'secret',
    fetchImpl,
    now: () => '2026-09-21T08:00:00.000Z'
  });

  assert.deepEqual(result, { approvedCount: 0, repairedCount: 1, alreadyApprovedCount: 0, verifiedCount: 1 });
  assert.equal(patches[0].confirmation_record.verifiedAt, '2026-09-21T08:00:00.000Z');
});

test('refuses to approve unknown candidate IDs', async () => {
  let reads = 0;
  const fetchImpl = async () => jsonResponse(reads++ === 0 ? [] : []);
  await assert.rejects(
    approveReviewCandidates({
      candidateIds: ['missing'],
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'secret',
      fetchImpl
    }),
    /Review candidates not found: missing/
  );
});
