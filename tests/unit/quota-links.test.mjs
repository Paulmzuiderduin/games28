import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateQuotaLinks, quotaLinkProblem, reviewQuotaRecords, validateQuotaSelection } from '../../src/lib/quota-links.js';

const quota = { id: 'quota', noc: 'NED', sport: 'Athletics', subjectType: 'noc_quota', state: 'allocated', disciplines: ["Men's 100m"], quotaCount: 2 };
const athlete = { id: 'a', noc: 'NED', sport: 'Athletics', subjectType: 'athlete', state: 'selected', disciplines: ["Men's 100m"], athleteName: 'Athlete A', allocationRecordId: 'quota' };

test('partial and full quotas retain the allocation while tracking selected occupants', () => {
  const partial = annotateQuotaLinks([quota, athlete]);
  assert.equal(partial.length, 2);
  assert.equal(partial[0].filledQuotaCount, 1);
  assert.equal(partial[0].remainingQuotaCount, 1);
  const full = annotateQuotaLinks([quota, athlete, { ...athlete, id: 'b', athleteName: 'Athlete B' }]);
  assert.equal(full[0].remainingQuotaCount, 0);
  assert.equal(full[0].quotaCount, 2);
});
test('invalid country/event/type links are rejected rather than filling an unrelated quota', () => {
  for (const change of [{ noc: 'USA' }, { sport: 'Swimming' }, { disciplines: ["Men's 200m"] }, { subjectType: 'team' }]) {
    assert.ok(quotaLinkProblem({ ...athlete, ...change }, quota));
    assert.throws(() => validateQuotaSelection({ ...athlete, ...change }, [quota]));
  }
});
test('excess selections require review without discarding confirmed records', () => {
  const fullQuota = { ...quota, canonicalEventKey: 'athletics:men-100m', quotaCount: 1 };
  const other = { ...athlete, canonicalEventKey: 'athletics:men-100m', id: 'b', athleteName: 'Athlete B' };
  assert.throws(() => validateQuotaSelection(other, [fullQuota, athlete]), /exceed/);
  const annotated = annotateQuotaLinks([fullQuota, athlete, other]);
  assert.equal(annotated.length, 3);
  assert.ok(annotated[0].quotaLinkProblem);
  assert.equal(annotated[0].quotaOccupants.length, 0);
});
test('a named pair fills one team quota, not two athlete places', () => {
  const teamQuota = { ...quota, subjectType: 'team_quota', quotaCount: 1, teamSizeMax: 2 };
  const team = { ...athlete, subjectType: 'team', teamName: 'Player A and Player B', athleteName: null };
  assert.equal(annotateQuotaLinks([teamQuota, team])[0].filledQuotaCount, 1);
});
test('withdrawn athletes release their occupancy; duplicate evidence does not double-fill a place', () => {
  assert.equal(annotateQuotaLinks([quota, { ...athlete, state: 'withdrawn' }])[0].filledQuotaCount, 0);
  assert.equal(annotateQuotaLinks([quota, athlete, { ...athlete, id: 'other-source' }])[0].filledQuotaCount, 1);
});
test('admin capacity uses recent approvals and explicit rejection, not only yesterday public data', () => {
  const current = reviewQuotaRecords([quota, { ...athlete, id: 'approved-review-a' }], [
    { id: 'review-a', status: 'rejected' },
    { id: 'review-b', status: 'approved', confirmation_record: { ...athlete, id: 'approved-review-b' } }
  ]);
  assert.deepEqual(current.map(record => record.id), ['quota', 'approved-review-b']);
});
test('admin corrections cannot hide another country, event, or cyclicly linked quotas', () => {
  const original = { ...quota, sourcePublishedAt: '2026-08-01' };
  const correction = { ...original, id: 'correction', supersedesId: original.id, sourcePublishedAt: '2026-08-02' };
  for (const change of [{ noc: 'USA' }, { disciplines: ["Men's 200m"] }, { sourcePublishedAt: '2026-07-01' }]) {
    const records = reviewQuotaRecords([original], [{ status: 'approved', confirmation_record: { ...correction, ...change } }]);
    assert.equal(records.length, 2);
    assert.ok(records.some(record => record.id === original.id));
  }
  assert.equal(reviewQuotaRecords([original], [{ status: 'approved', confirmation_record: correction }]).length, 1);
  assert.equal(reviewQuotaRecords([{ ...original, supersedesId: correction.id }, correction], []).length, 2);
});

test('updating a selection does not count its existing record twice', () => {
  const canonicalEventKey = 'athletics:men-100m';
  assert.doesNotThrow(() => validateQuotaSelection({ ...athlete, canonicalEventKey }, [{ ...quota, canonicalEventKey, quotaCount: 1 }, athlete]));
});
test('new admin links require canonical events without discarding historical label-based links', () => {
  assert.equal(annotateQuotaLinks([quota, athlete])[0].filledQuotaCount, 1);
  for (const [selection, allocation] of [[athlete, quota], [{ ...athlete, canonicalEventKey: 'a' }, quota], [athlete, { ...quota, canonicalEventKey: 'a' }]]) {
    assert.match(quotaLinkProblem(selection, allocation, { requireCanonicalEvent: true }), /verified event/);
    assert.throws(() => validateQuotaSelection(selection, [allocation]), /verified event/);
  }
  assert.doesNotThrow(() => validateQuotaSelection({ ...athlete, allocationRecordId: null }, [quota]));
});
test('missing or withdrawn quota retains the named record but does not invent occupancy', () => {
  assert.ok(annotateQuotaLinks([athlete])[0].allocationLinkProblem);
  const records = annotateQuotaLinks([{ ...quota, state: 'withdrawn' }, athlete]);
  assert.ok(records[1].allocationLinkProblem);
  assert.equal(records[0].filledQuotaCount, 0);
});

test('a quota source-record correction keeps the selection linked to the same quota identity', async () => {
  const { toQualificationCards } = await import('../../scripts/qualification-records.mjs');
  const oldQuota = { ...quota, recordKey: 'same-quota-event', scheduleHints: [], events: [] };
  const newQuota = { ...oldQuota, id: 'corrected-quota' };
  const selection = { ...athlete, recordKey: 'athlete-event', scheduleHints: [], events: [] };
  const cards = toQualificationCards([newQuota, selection], [oldQuota, newQuota, selection]);
  assert.equal(cards[1].allocationRecordId, 'corrected-quota');
  assert.equal(annotateQuotaLinks(cards)[0].filledQuotaCount, 1);
  assert.equal(selection.allocationRecordId, 'quota', 'original evidence is not mutated');
});
