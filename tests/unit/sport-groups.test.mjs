import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSportDirectory, buildScheduleOptions, filterScheduleEntries, getQualificationSportLabels } from '../../src/lib/view-models.js';
import { getSportPath, findSportBySlug } from '../../src/lib/seo.js';

const entries = ['Boxing - Preliminary Stages', 'Boxing - Final Stages'].map((sport, i) => ({ id: String(i), sport }));
test('boxing stages share one directory, filter and canonical route without mutating data', () => {
  const directory = buildSportDirectory({ scheduleEntries: entries });
  assert.equal(directory.length, 1);
  assert.equal(directory[0].sport, 'Boxing');
  assert.equal(directory[0].sessionCount, 2);
  assert.deepEqual(buildScheduleOptions(entries).sportOptions, ['Boxing']);
  assert.equal(filterScheduleEntries(entries, { sport: 'Boxing', dayKey: 'all' }).length, 2);
  for (const entry of entries) assert.equal(getSportPath(entry.sport), '/sports/boxing');
  for (const slug of ['boxing', 'boxing-preliminary-stages', 'boxing-final-stages']) {
    assert.equal(findSportBySlug(entries, slug), 'Boxing');
  }
  assert.equal(entries[0].sport, 'Boxing - Preliminary Stages');
});
test('qualification mappings count one record even when both boxing stage labels are mapped', () => {
  const runtime = {
    scheduleEntries: entries,
    meta: { qualificationSources: [{ id: 'boxing-source', sports: entries.map(e => e.sport) }] },
    athleteCards: [{ id: 'quota', sourceId: 'boxing-source', sport: 'Boxing', noc: 'NED' }]
  };
  assert.deepEqual(getQualificationSportLabels(runtime, runtime.athleteCards[0]), ['Boxing']);
  assert.equal(buildSportDirectory(runtime)[0].qualificationRecordCount, 1);
});
