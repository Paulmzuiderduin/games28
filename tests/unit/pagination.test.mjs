import test from 'node:test';
import assert from 'node:assert/strict';
import { collectIdPages, fetchRestIdPages, fetchClientIdPages } from '../../src/lib/pagination.js';
import { syncReviewCandidates } from '../../scripts/sync-review-candidates-to-supabase.mjs';

const records = Array.from({ length: 1205 }, (_, index) => ({ id: `record-${String(index).padStart(5, '0')}`, status: 'approved' }));
function pageAfter(after, cap = 97) {
  return records.filter(row => after === null || row.id > after).slice(0, cap);
}

test('reads beyond 1000 rows even when the server cap is lower than requested', async () => {
  assert.deepEqual(await collectIdPages(async ({ afterId }) => pageAfter(afterId)), records);
});
test('fails instead of returning a partial dataset on repeated pages, malformed results or later errors', async () => {
  await assert.rejects(collectIdPages(async () => [{ id: 'repeated' }]), /did not advance/);
  await assert.rejects(collectIdPages(async () => null), /Invalid/);
  await assert.rejects(collectIdPages(async ({ afterId }) => {
    if (afterId) throw new Error('offline');
    return [{ id: 'first' }];
  }), /offline/);
});
test('REST paging applies stable ordering, preserves select and reads through an empty page', async () => {
  const rows = await fetchRestIdPages('https://example.supabase.co/rest/v1/review?select=id,status', {
    fetchImpl: async (address) => {
      const url = new URL(address);
      assert.equal(url.searchParams.get('order'), 'id.asc');
      assert.equal(url.searchParams.get('select'), 'id,status');
      return new Response(JSON.stringify(pageAfter(url.searchParams.get('id')?.slice(3) ?? null)));
    }
  });
  assert.equal(rows.length, 1205);
});
test('browser paging retrieves all rows then restores newest-first display', async () => {
  const client = { from(table) {
    assert.equal(table, 'qualification_review_candidates');
    let after = null;
    return {
      select() { return this; },
      order(column, options) { assert.equal(column, 'id'); assert.equal(options.ascending, true); return this; },
      limit() { return this; },
      gt(column, value) { assert.equal(column, 'id'); after = value; return this; },
      then(resolve) { return Promise.resolve({ data: pageAfter(after).map(row => ({ ...row, detected_at: row.id })), error: null }).then(resolve); }
    };
  } };
  const rows = await fetchClientIdPages(client, 'qualification_review_candidates', 'detected_at');
  assert.equal(rows.length, 1205);
  assert.equal(rows[0].id, records.at(-1).id);
});
test('sync does not reinsert an approved candidate beyond the first 1000 rows', async () => {
  const result = await syncReviewCandidates({
    candidates: [{ id: records.at(-1).id }], supabaseUrl: 'https://example.supabase.co', serviceRoleKey: 'test-only',
    fetchImpl: async (address, options) => {
      assert.equal(options.method, undefined, 'existing approvals must not be written');
      const after = new URL(address).searchParams.get('id')?.slice(3) ?? null;
      return new Response(JSON.stringify(pageAfter(after)));
    }
  });
  assert.equal(result.insertedCount, 0);
  assert.equal(result.existingCount, 1205);
});
