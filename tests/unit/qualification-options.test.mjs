import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getQualificationEventOptions, getQualificationSportOptions } from '../../src/lib/qualification-options.js';
import { buildQualificationSystemIndex, toQualificationSources } from '../../scripts/qualification-systems.mjs';

async function sources() {
  const runtime = JSON.parse(await readFile(new URL('../../src/data/runtime.json', import.meta.url), 'utf8'));
  return toQualificationSources(buildQualificationSystemIndex(runtime.scheduleEntries).systems);
}

test('qualification option lists are source-driven, not derived from LA28 session rows', async () => {
  const sourceList = await sources();
  const sports = getQualificationSportOptions(sourceList);
  const equestrianSource = sourceList.find((source) => source.qualificationSystemKey === 'equestrian');
  const events = getQualificationEventOptions(sourceList, 'Equestrian', equestrianSource.id);

  assert.equal(sports.includes('Equestrian'), true);
  assert.equal(sports.includes('Boxing'), true);
  assert.equal(sports.includes('Boxing - Preliminary Stages'), false);
  assert.deepEqual(events.map((event) => event.label), [
    'Dressage - Individual',
    'Dressage - Team',
    'Eventing - Individual',
    'Eventing - Team',
    'Jumping - Individual',
    'Jumping - Team'
  ]);
  assert.equal(events.some((event) => /Grand Prix|Session|Day \d|Qualifier/i.test(event.label)), false);
});

test('qualification event choices only apply to their configured sport and source', async () => {
  const sourceList = await sources();
  const equestrianSource = sourceList.find((source) => source.qualificationSystemKey === 'equestrian');

  assert.deepEqual(getQualificationEventOptions(sourceList, 'Equestrian', 'if-cricket'), []);
  assert.equal(getQualificationEventOptions(sourceList, 'Cricket', equestrianSource.id).length, 0);
});
