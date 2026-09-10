import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildQuotaGuardSnapshot } from '../../scripts/quota-guard-snapshot.mjs';
const quota = { id: 'q', noc: 'NED', sport: 'Athletics', canonicalEventKey: 'athletics:men-100', subjectType: 'noc_quota', quotaCount: 1, state: 'allocated' };
const runtime = (records) => ({ checkedAt: '2026-09-09T12:00:00Z', qualificationRecords: records });
test('quota registry retirement is scoped for the REST safeupdate guard', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20260910183640_scope_quota_registry_retirement.sql', import.meta.url), 'utf8');
  assert.match(sql, /update games28_private\.quota_registry set active = false, checked_at = incoming_time\s+where active;/i);
  assert.doesNotMatch(sql, /security definer|safeupdate\s*=\s*(?:off|false)/i);
});
test('server snapshot carries actual capacity, linked occupancy, and no review evidence', () => {
  const result = buildQuotaGuardSnapshot(runtime([quota, { ...quota, id: 'a', subjectType: 'athlete', athleteName: 'Runner', allocationRecordId: 'q', state: 'selected', extractedEvidence: 'private evidence' }]));
  assert.equal(result.quotas[0].quotaCount, 1);
  assert.deepEqual(result.quotas[0].occupants, [{ id: 'a', name: 'Runner', subjectType: 'athlete', sourcePublishedAt: null }]);
  assert.ok(!JSON.stringify(result).includes('private evidence'));
});
test('incomplete, duplicate, ambiguous and overfilled snapshots cannot overwrite server state', () => {
  for (const value of [{}, runtime([quota, quota]), runtime([{ ...quota, noc: null }]), runtime([{ ...quota, quotaCount: 0 }]), runtime([quota,
    { ...quota, id: 'a', subjectType: 'athlete', athleteName: 'One', allocationRecordId: 'q', state: 'selected' },
    { ...quota, id: 'b', subjectType: 'athlete', athleteName: 'Two', allocationRecordId: 'q', state: 'selected' }
  ])]) assert.throws(() => buildQuotaGuardSnapshot(value));
});

test('ambiguous legacy quotas remain recorded but cannot authorize a selection link', () => {
  const snapshot = buildQuotaGuardSnapshot(runtime([{ ...quota, canonicalEventKey: null }]));
  assert.equal(snapshot.quotas.length, 1);
  assert.equal(snapshot.quotas[0].linkable, false);
  assert.match(snapshot.quotas[0].linkProblem, /canonical event/);
});

test('broken active selection links cannot silently free server quota capacity', async () => {
  const { syncQuotaGuardSnapshot } = await import('../../scripts/quota-guard-snapshot.mjs');
  const selection = { ...quota, id: 'person', subjectType: 'athlete', athleteName: 'Private name', state: 'selected', allocationRecordId: quota.id };
  for (const change of [{ allocationRecordId: 'missing' }, { noc: 'USA' }, { canonicalEventKey: 'another-event' }, { subjectType: 'team' }]) {
    let fetched = false;
    await assert.rejects(syncQuotaGuardSnapshot({ runtime: runtime([quota, { ...selection, ...change }]), supabaseUrl: 'https://test.supabase.co', serviceRoleKey: 'secret', fetchImpl: async () => { fetched = true; return new Response('1'); } }), /unresolved selection links/);
    assert.equal(fetched, false, 'invalid snapshot must never reach the server');
  }
  const withdrawn = buildQuotaGuardSnapshot(runtime([quota, { ...selection, state: 'withdrawn', allocationRecordId: 'missing' }]));
  assert.equal(withdrawn.quotas[0].occupants.length, 0);
});

test('sync refuses missing credentials and server failure instead of silently continuing', async () => {
  const { syncQuotaGuardSnapshot } = await import('../../scripts/quota-guard-snapshot.mjs');
  const input = { runtime: runtime([quota]), supabaseUrl: 'https://test.supabase.co', serviceRoleKey: 'test-secret' };
  await assert.rejects(syncQuotaGuardSnapshot({ runtime: input.runtime }), /server credentials/);
  await assert.rejects(syncQuotaGuardSnapshot({ ...input, fetchImpl: async () => new Response('private server details', { status: 409 }) }), error => /409/.test(error.message) && !error.message.includes('private'));
  for (const code of ['22023', 'PGRST202', 'private details']) {
    await assert.rejects(syncQuotaGuardSnapshot({ ...input, fetchImpl: async () => new Response(JSON.stringify({ code, message: 'private evidence', details: 'private record' }), { status: 400 }) }), error =>
      error.message.includes('400') && !error.message.includes('private') && (code === 'private details' || error.message.includes(code)));
  }
  const count = await syncQuotaGuardSnapshot({ ...input, fetchImpl: async (url, options) => {
    assert.match(url, /rpc\/sync_games28_quota_snapshot$/);
    assert.equal(JSON.parse(options.body).p_snapshot.quotas.length, 1);
    return new Response('1');
  } });
  assert.equal(count, 1);
});
