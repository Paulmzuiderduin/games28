import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScheduleCandidate, preserveScheduleIds } from '../../scripts/schedule-candidate.mjs';
import { choosePublishedSchedule, validateOfficialCandidate } from '../../scripts/update-data.mjs';

const event = (eventName, id) => ({ sessionCode: 'ARC03', eventName, id });
test('IDs survive description reordering and new rows without giving moved events an old link', () => {
  const old = [event('Gold Medal Match', 'existing-link')];
  const next = preserveScheduleIds([event('Semifinal', 'index-0'), event('Gold Medal Match', 'index-1')], old);
  assert.equal(next[1].id, 'existing-link');
  assert.equal(next[0].id, preserveScheduleIds([event('Semifinal', 'other-index')])[0].id);
  assert.notEqual(preserveScheduleIds([{ ...old[0], sessionCode: 'ARC04' }], old)[0].id, 'existing-link');
});

test('parse exceptions and duplicate event identities retain last good publication', async () => {
  const previous = [event('Final', 'kept')];
  for (const parse of [async () => { throw new Error('Changed layout'); }, async () => [], async () => [event('Final'), event('Final')]]) {
    const result = await buildScheduleCandidate(null, {}, previous, parse);
    assert.ok(result.parserError);
    assert.deepEqual(result.entries, []);
    const publication = choosePublishedSchedule({ validation: { passed: false }, candidate: result.entries,
      previousRuntime: { meta: { scheduleAuthority: 'official_pdf' }, scheduleEntries: previous }, communityReference: [], sourceCheck: {} });
    assert.equal(publication.scheduleAuthority, 'stale_official');
    assert.deepEqual(publication.publishedSchedule, previous);
  }
});

test('full official fixture passes publication gates and retains unchanged public IDs', async () => {
  const load = (name) => JSON.parse(readFileSync(new URL(`../../src/data/${name}`, import.meta.url)));
  const previous = load('runtime.json');
  const pdf = readFileSync(new URL('../../src/data/official-schedule-by-event.snapshot.pdf', import.meta.url));
  const result = await buildScheduleCandidate(pdf, {}, previous.scheduleEntries);
  assert.equal(result.parserError, null);
  const validation = validateOfficialCandidate(result.entries, load('schedule-community-reference.json'), previous);
  assert.equal(validation.passed, true, JSON.stringify(validation));
  assert.equal(new Set(result.entries.map((row) => row.sessionCode)).size, 842);
  const old = new Map(previous.scheduleEntries.map((row) => [JSON.stringify([row.sessionCode, row.eventName]), row.id]));
  for (const row of result.entries) {
    const oldId = old.get(JSON.stringify([row.sessionCode, row.eventName]));
    if (oldId) assert.ok([row.id, ...(row.aliasIds || [])].includes(oldId));
  }
});

test('duplicate historical links remain aliases across subsequent refreshes', () => {
  const next = preserveScheduleIds([event('Final')], [event('Final', 'first'), event('Final', 'second')]);
  assert.deepEqual(next[0].aliasIds, ['second']);
  assert.deepEqual(preserveScheduleIds([event('Final')], next), next);
});
