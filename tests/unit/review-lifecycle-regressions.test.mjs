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

test('a cached official PDF passing validation is not a fresh publication or promotion', () => {
  const input = { validation: { passed: true }, candidate: [{ id: 'cached' }], communityReference: [{ id: 'mirror' }], sourceCheck: { officialShadowSuccessStreak: 2 }, officialFetchUsedFallback: true };
  const existing = choosePublishedSchedule({ ...input, previousRuntime: { meta: { scheduleAuthority: 'official_pdf' }, scheduleEntries: [{ id: 'published' }] } });
  assert.equal(existing.scheduleAuthority, 'stale_official');
  assert.equal(existing.publishedSchedule[0].id, 'published');
  assert.match(existing.staleWarning, /cached PDF/);
  assert.equal(existing.officialShadowSuccessStreak, 0);
  const shadow = choosePublishedSchedule({ ...input, previousRuntime: { meta: { scheduleAuthority: 'community_reference' }, scheduleEntries: [{ id: 'mirror' }] } });
  assert.equal(shadow.scheduleAuthority, 'community_reference');
  assert.equal(shadow.promotionAchieved, false);
});

test('supersession cannot remove another country or event or consume an allocation with a selection', () => {
  for (const change of [{ noc: 'USA' }, { disciplines: ['200m'] }, { subjectType: 'noc_quota', athleteName: null, quotaCount: 1 }]) {
    const { records } = normalizeQualificationRecords([base, { ...base, ...change, id: 'other', supersedesId: 'one', sourcePublishedAt: '2028-06-10' }], [source]);
    assert.equal(resolveActiveQualificationRecords(records).length, 2);
  }
});

test('cyclic replacements preserve active evidence rather than hiding both people', () => {
  const { records } = normalizeQualificationRecords([
    { ...base, supersedesId: 'two' },
    { ...base, id: 'two', athleteName: 'Other Runner', supersedesId: 'one' }
  ], [source]);
  assert.equal(resolveActiveQualificationRecords(records).length, 2);
});

test('valid later replacement supersedes the earlier named athlete but retains history', () => {
  const { records } = normalizeQualificationRecords([base, { ...base, id: 'replacement', athleteName: 'Other Runner', supersedesId: 'one', sourcePublishedAt: '2028-06-10' }], [source]);
  assert.deepEqual(resolveActiveQualificationRecords(records).map((record) => record.id), ['replacement']);
  assert.equal(records.length, 2);
});

test('later reviewed clerical quota correction can replace an erroneous type and source date', () => {
  const old = { ...base, id:'wrong-type', subjectType:'noc_quota', quotaCount:3, disciplines:['Dressage'], sport:'Equestrian', reviewCandidateId:'old-review', verifiedAt:'2028-06-02', sourcePublishedAt:'2028-06-01' };
  const correction = { ...old, id:'correct-type', subjectType:'team_quota', quotaCount:1, disciplines:['Dressage - Team'], supersedesId:old.id, reviewCandidateId:'new-review', verifiedAt:'2028-06-03', sourcePublishedAt:'2028-05-30' };
  const { records } = normalizeQualificationRecords([old, correction], [source]);
  assert.deepEqual(resolveActiveQualificationRecords(records).map(row=>row.id), ['correct-type']);
  const crossCountry = normalizeQualificationRecords([old,{...correction,noc:'USA'}],[source]);
  assert.equal(resolveActiveQualificationRecords(crossCountry.records).length,2);
});
