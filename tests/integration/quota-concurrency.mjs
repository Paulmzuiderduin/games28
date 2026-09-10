// Run only against a disposable PostgreSQL database with the guard migration.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
if (process.env.PGDATABASE !== 'games28_guard_test') throw new Error('Use the disposable games28_guard_test database only');
const psql = process.env.GAMES28_PSQL || 'psql';
const sql = (query, application = 'quota-test') => exec(psql, ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query], { env: { ...process.env, PGAPPNAME: application } });
const record = (id) => JSON.stringify({ id, noc:'NED',sport:'Athletics',subjectType:'athlete',state:'selected',athleteName:id,canonicalEventKey:'athletics:100m-men',allocationRecordId:'race-quota' });
const insert = (id) => `insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values('${id}','test','https://example.com','Test','Test',now(),'approved','${record(id)}');`;
await sql(`select public.sync_games28_quota_snapshot('{"checkedAt":"2028-01-01T00:00:00Z","quotas":[{"id":"race-quota","noc":"NED","sport":"Athletics","subjectType":"noc_quota","quotaCount":1,"canonicalEventKey":"athletics:100m-men","linkable":true,"occupants":[]}]}');`);
const first = sql(`begin; ${insert('race-one')} select pg_sleep(3); commit;`, 'quota-race-first');
let waiting = false;
for(let i=0;i<100;i++) {
  const state = await sql("select count(*) from pg_stat_activity where application_name='quota-race-first' and wait_event='PgSleep'");
  if(state.stdout.trim()==='1') { waiting=true; break; }
  await new Promise(resolve=>setTimeout(resolve,20));
}
assert.ok(waiting,'First connection never acquired the quota and paused');
const second = sql(insert('race-two'),'quota-race-second').then(()=>({accepted:true}),error=>({accepted:false,message:error.stderr}));
await first;
const result = await second;
assert.equal(result.accepted,false,'Both concurrent approvals filled a one-place quota');
assert.match(result.message,/This quota is already full/);
const count=await sql("select count(*) from public.qualification_review_candidates where id in ('race-one','race-two') and status='approved'");
assert.equal(count.stdout.trim(),'1');
console.log('PASS: second concurrent approval waits, rechecks, and rejects; exactly one approved selection');
