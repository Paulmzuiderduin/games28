import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildQualificationPipeline, toQualificationCards } from '../../scripts/qualification-records.mjs';
import { qualificationSystems, toQualificationSources } from '../../scripts/qualification-systems.mjs';
import { buildCountrySelectionRegistry, toCountrySelectionSources } from '../../scripts/country-selection-registry.mjs';

const read = async (name) => JSON.parse(await readFile(new URL(`../../src/data/${name}`, import.meta.url), 'utf8'));
const input = await read('qualification-sources.source.json');
const overrides = await read('country-selection-source-overrides.json');
const sources = [...toQualificationSources(qualificationSystems), ...toCountrySelectionSources(buildCountrySelectionRegistry(overrides.sources.map(({ noc }) => ({ noc, name: noc })), overrides))];
const records = input.records.filter((r) => r.id.startsWith('verified-') && r.verifiedAt === '2026-09-25T00:00:00.000Z');

test('eight researched quotas publish as country places, not named selections', () => {
  assert.equal(records.length, 8);
  const result = buildQualificationPipeline({ records }, sources);
  assert.deepEqual(result.rejected, []);
  assert.equal(result.activeRecords.length, 8);
  assert.equal(result.reviewQueue.length, 0);
  for (const card of toQualificationCards(result.activeRecords)) {
    assert.equal(card.status, 'quota');
    assert.equal(card.state, 'allocated');
    assert.ok(card.canonicalEventKey);
  }
  assert.deepEqual(records.filter((r) => r.sport === 'Equestrian').map((r) => r.noc).sort(), ['BEL', 'FRA', 'GBR', 'GER', 'IRL', 'ITA', 'SUI']);
});

test('later duplicate approval does not double-count the verified country quota', () => {
  const result = buildQualificationPipeline({ records: [...records, ...records.map((r) => ({ ...r, id: `later-${r.id}`, verifiedAt: '2026-09-26T00:00:00.000Z', sourceRecordType: 'review_approved' }))] }, sources);
  assert.deepEqual(result.rejected, []);
  assert.equal(result.activeRecords.length, 8);
  assert.equal(result.history.length, 16);
});
