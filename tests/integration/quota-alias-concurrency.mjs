// Run against a fresh disposable database with the quota migrations installed.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
if (process.env.PGDATABASE !== 'games28_alias_test') throw new Error('Use the disposable games28_alias_test database only');
const sql = (query, application = 'alias-test') => exec(process.env.GAMES28_PSQL || 'psql', ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query], { env: { ...process.env, PGAPPNAME: application } });
const quota = { id: 'alias-old', recordKey: 'same-quota', noc: 'NED', sport: 'Athletics', subjectType: 'noc_quota', quotaCount: 1, canonicalEventKey: 'athletics:men-100m', linkable: true, occupants: [] };
const snapshot = (value, date) => `select public.sync_games28_quota_snapshot('${JSON.stringify({ checkedAt: date, quotas: [value] })}');`;
const insert = id => `insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values('${id}','test','https://example.com','Test','Test',now(),'approved','${JSON.stringify({ id, noc: 'NED', sport: 'Athletics', subjectType: 'athlete', state: 'selected', athleteName: id, canonicalEventKey: quota.canonicalEventKey, allocationRecordId: quota.id, sourcePublishedAt: '2028-06-01' })}');`;
await sql(snapshot(quota, '2028-01-01T00:00:00Z'));
await sql(insert('alias-person'));
const updated = { ...quota, id: 'alias-new', occupants: [{ id: 'alias-person', name: 'alias-person', subjectType: 'athlete', sourcePublishedAt: '2028-06-01' }] };
const first = sql(`begin; ${snapshot(updated, '2028-01-02T00:00:00Z')} select pg_sleep(4); commit;`, 'alias-publisher');
async function waitFor(application, clause) {
  for (let i = 0; i < 100; i++) {
    const result = await sql(`select count(*) from pg_stat_activity where application_name='${application}' and ${clause}`);
    if (result.stdout.trim() === '1') return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`No expected database wait observed for ${application}`);
}
await waitFor('alias-publisher', "wait_event='PgSleep'");
const second = sql(insert('alias-extra'), 'alias-approval').then(() => ({ accepted: true }), error => ({ accepted: false, message: error.stderr }));
await waitFor('alias-approval', "wait_event_type='Lock'");
await first;
const result = await second;
assert.equal(result.accepted, false);
assert.match(result.message, /This quota is already full/);
const count = await sql("select count(*) from public.qualification_review_candidates where id in ('alias-person','alias-extra')");
assert.equal(count.stdout.trim(), '1');
console.log('PASS: old-ID approval waits for source correction, resolves the new quota and rejects overcapacity.');
