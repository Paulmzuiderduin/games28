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

test('new official qualification discoveries are review-only and exclude existing records', async () => {
  const countries = JSON.parse(await readFile(new URL('../../src/data/countries.registry.json', import.meta.url), 'utf8'));
  const overrides = JSON.parse(await readFile(new URL('../../src/data/country-selection-source-overrides.json', import.meta.url), 'utf8'));
  const qualificationInput = JSON.parse(await readFile(new URL('../../src/data/qualification-sources.source.json', import.meta.url), 'utf8'));
  const sources = toCountrySelectionSources(buildCountrySelectionRegistry(countries, overrides));
  const discovered = sources.filter((source) => source.id.endsWith('2026-la28') || source.id === 'if-fivb-usa-host-la28');
  const candidates = discovered.flatMap((source) => source.confirmationCandidates);
  const identities = candidates.map((candidate) => [
    candidate.noc,
    candidate.sport,
    candidate.discipline,
    candidate.teamName || candidate.subjectType
  ].join('|'));

  assert.equal(discovered.length, 11);
  assert.equal(candidates.length, 23);
  assert.equal(discovered.every((source) => source.status === 'review_required'), true);
  assert.equal(new Set(identities).size, identities.length);
  assert.equal(candidates.some((candidate) => candidate.noc === 'NED' && candidate.sport === 'Beach Volleyball'), false);
  assert.equal(candidates.every((candidate) => !/preliminary|quarter|semi|final/i.test(candidate.discipline)), true);
  const beachCandidates = sources
    .filter((source) => source.sport === 'Beach Volleyball' || source.sports?.includes('Beach Volleyball'))
    .flatMap((source) => source.confirmationCandidates.filter((candidate) => candidate.sport === 'Beach Volleyball'));
  assert.equal(beachCandidates.length, 10);
  assert.equal(beachCandidates.every((candidate) => candidate.subjectType === 'team_quota' && candidate.quotaCount === 1 && !candidate.teamName), true);
  assert.equal(candidates.filter((candidate) => candidate.noc === 'USA').length, 4);

  const queuedIdentities = new Set((qualificationInput.reviewQueue || []).map((entry) => [
    entry.suggestedRecord?.noc,
    entry.suggestedRecord?.sport,
    entry.suggestedRecord?.disciplines?.[0],
    entry.suggestedRecord?.teamName || entry.suggestedRecord?.subjectType
  ].join('|')));
  assert.equal(identities.every((identity) => queuedIdentities.has(identity)), true);
});
