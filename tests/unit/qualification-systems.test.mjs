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
  assert.equal(sources.every((source) => /^https:\/\//.test(source.url) && source.sourceTier === 'if'), true);
});
