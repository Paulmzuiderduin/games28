import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCountrySelectionRegistry, toCountrySelectionSources } from '../../scripts/country-selection-registry.mjs';

test('every IOC NOC receives an explicit official selection source slot', async () => {
  const countries = JSON.parse(await readFile(new URL('../../src/data/countries.registry.json', import.meta.url), 'utf8'));
  const registry = buildCountrySelectionRegistry(countries);

  assert.equal(registry.length, countries.length);
  assert.equal(registry.every((entry) => entry.noc && /^https:\/\//.test(entry.nocAuthorityUrl || '')), true);
  assert.equal(registry.every((entry) => entry.status === 'awaiting_endpoint'), true);
});

test('configured NOC and national federation endpoints become trusted source definitions', async () => {
  const countries = JSON.parse(await readFile(new URL('../../src/data/countries.registry.json', import.meta.url), 'utf8'));
  const registry = buildCountrySelectionRegistry(countries, {
    sources: [{
      noc: 'NED',
      officialNocUrl: 'https://noc.example.org/la28',
      nationalFederationUrls: ['https://federation.example.org/la28']
    }]
  });
  const sources = toCountrySelectionSources(registry);

  assert.deepEqual(sources.map((source) => source.sourceTier).sort(), ['national_federation', 'noc']);
  assert.equal(sources.every((source) => source.refreshPolicy === 'daily'), true);
});

test('official selection announcements retain review prefill metadata', async () => {
  const registry = buildCountrySelectionRegistry([{ noc: 'NED', name: 'Netherlands', profileUrl: 'https://olympics.example/ned' }], {
    sources: [{
      noc: 'NED',
      selectionSources: [{
        id: 'noc-ned-selection',
        url: 'https://noc.example.org/la28-selection',
        sport: 'Example Sport',
        adapter: 'official_confirmation_article',
        evidenceTerms: ['LA28'],
        confirmationCandidates: [{ noc: 'NED', sport: 'Example Sport', evidenceTerms: ['Netherlands'] }]
      }]
    }]
  });
  const [source] = toCountrySelectionSources(registry);

  assert.equal(source.adapter, 'official_confirmation_article');
  assert.deepEqual(source.confirmationCandidates[0].noc, 'NED');
});
