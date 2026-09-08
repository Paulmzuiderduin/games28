import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQualificationRecords, resolveActiveQualificationRecords } from '../../scripts/qualification-records.mjs';
import { choosePublishedSchedule } from '../../scripts/update-data.mjs';

const source = { id: 'official', sourceTier: 'if', url: 'https://official.example/allocations' };
const base = { id: 'one', noc: 'NED', sport: 'Athletics', subjectType: 'athlete', athleteName: 'Example Runner', state: 'selected', sourceId: 'official', sourcePublishedAt: '2028-06-01', verifiedAt: '2028-06-02', disciplines: ['100m'] };
test('an athlete retains distinct event qualifications, even with a legacy shared key', () => {
  const raw = [{...base, recordKey: 'old-athlete-key'}, {...base, id:'two', recordKey:'old-athlete-key', disciplines:['200m']}];
  const first = normalizeQualificationRecords(raw, [source]);
  assert.equal(first.rejected.length,0);
  assert.equal(resolveActiveQualificationRecords(first.records).length,2);
  const second = normalizeQualificationRecords(first.records,[source]);
  assert.deepEqual(second.records.map(r=>r.recordKey), first.records.map(r=>r.recordKey));
});
test('withdrawal wins over the same event but not another event, independently of input order', () => {
  const raw = [base, {...base,id:'two',disciplines:['200m']}, {...base,id:'withdrawal',state:'withdrawn',sourcePublishedAt:'2028-06-10'}];
  for (const list of [raw,[...raw].reverse()]) {
    const {records}=normalizeQualificationRecords(list,[source]);
    assert.deepEqual(resolveActiveQualificationRecords(records).map(r=>r.id),['two']);
  }
});
test('later explicit reinstatement can restore a withdrawn event', () => {
  const {records}=normalizeQualificationRecords([base,{...base,id:'withdrawal',state:'withdrawn',sourcePublishedAt:'2028-06-10'}, {...base,id:'reinstated',sourcePublishedAt:'2028-06-11'}],[source]);
  assert.deepEqual(resolveActiveQualificationRecords(records).map(r=>r.id),['reinstated']);
});
test('official schedule survives repeated failed refreshes and recovers without mirror downgrade', () => {
  let previousRuntime={meta:{scheduleAuthority:'official_pdf'},scheduleEntries:[{id:'last-good'}]};
  for(let i=0;i<3;i++) {
    const result=choosePublishedSchedule({validation:{passed:false}, candidate:[], communityReference:[{id:'mirror'}],previousRuntime,sourceCheck:{}});
    assert.equal(result.scheduleAuthority,'stale_official');
    assert.equal(result.publishedSchedule[0].id,'last-good');
    previousRuntime={meta:{scheduleAuthority:result.scheduleAuthority},scheduleEntries:result.publishedSchedule};
  }
  const result=choosePublishedSchedule({validation:{passed:true},candidate:[{id:'new-good'}],communityReference:[],previousRuntime,sourceCheck:{officialShadowSuccessStreak:0}});
  assert.equal(result.scheduleAuthority,'official_pdf');
  assert.equal(result.publishedSchedule[0].id,'new-good');
});
