import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildQualificationSystemIndex, toQualificationSources } from '../../scripts/qualification-systems.mjs';

test('every schedule sport label has an official qualification-system source', async () => {
  const runtime = JSON.parse(await readFile(new URL('../../src/data/runtime.json', import.meta.url), 'utf8'));
  const index = buildQualificationSystemIndex(runtime.scheduleEntries);
  const sources = toQualificationSources(index.systems);

  assert.deepEqual(index.missingSports, []);
  assert.equal(new Set(index.systems.flatMap((system) => system.coveredSports)).size, new Set(runtime.scheduleEntries.map((entry) => entry.sport)).size);
  assert.equal(sources.every((source) => /^https:\/\//.test(source.url) && ['if', 'noc', 'national_federation'].includes(source.sourceTier)), true);
});

test('keeps the Aachen Dressage Team allocation as review-only team quotas', async () => {
  const runtime = JSON.parse(await readFile(new URL('../../src/data/runtime.json', import.meta.url), 'utf8'));
  const sources = toQualificationSources(buildQualificationSystemIndex(runtime.scheduleEntries).systems);
  const equestrian = sources.find((source) => source.qualificationSystemKey === 'equestrian');

  assert.equal(equestrian.status, 'review_required');
  assert.equal(equestrian.adapter, 'official_confirmation_article');
  assert.deepEqual(equestrian.confirmationCandidates.map((candidate) => candidate.noc), ['GER', 'GBR', 'DEN', 'BEL', 'NED', 'SWE']);
  assert.equal(equestrian.confirmationCandidates.every((candidate) => candidate.subjectType === 'team_quota' && candidate.quotaCount === 1 && candidate.teamSizeMax === 3), true);
});
