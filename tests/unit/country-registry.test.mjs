import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCountryRegistry } from '../../scripts/country-registry.mjs';

test('buildCountryRegistry maps ISO codes and falls back to noc badges', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'games28-country-registry-'));
  const registrySourcePath = join(tempDir, 'registry.json');
  const isoOverridesPath = join(tempDir, 'overrides.json');

  await writeFile(
    registrySourcePath,
    JSON.stringify({
      countries: [
        { noc: 'NED', name: 'Netherlands', continent: 'Europe' },
        { noc: 'TPE', name: 'Chinese Taipei', continent: 'Asia' },
        { noc: 'XYZ', name: 'Test Delegation', continent: 'Undetermined' }
      ]
    })
  );
  await writeFile(
    isoOverridesPath,
    JSON.stringify({
      overrides: { TPE: 'TW' },
      aliases: {}
    })
  );

  const countries = await buildCountryRegistry({ registrySourcePath, isoOverridesPath });
  assert.deepEqual(
    countries.find((country) => country.noc === 'NED'),
    {
      continent: 'Europe',
      flagMode: 'flag-icons',
      iso2: 'nl',
      name: 'Netherlands',
      noc: 'NED',
      profileUrl: 'https://www.olympics.com/ioc/national-olympic-committees',
      sourceUrl: 'https://www.olympics.com/ioc/national-olympic-committees'
    }
  );
  assert.equal(countries.find((country) => country.noc === 'TPE')?.iso2, 'tw');
  assert.equal(countries.find((country) => country.noc === 'XYZ')?.flagMode, 'noc-badge');
});

test('the maintained registry has complete names, continents and flags', async () => {
  const countries = await buildCountryRegistry({
    registrySourcePath: new URL('../../src/data/noc-registry.source.json', import.meta.url),
    isoOverridesPath: new URL('../../src/data/noc-iso-overrides.json', import.meta.url)
  });
  const continents = new Set(['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America']);
  assert.equal(countries.length, 205);
  assert.equal(new Set(countries.map((country) => country.noc)).size, 205);
  for (const legacy of ['LIB', 'MAL', 'SIN', 'RHO'])
    assert.equal(
      countries.some((country) => country.noc === legacy),
      false,
      legacy
    );
  for (const country of countries) {
    assert.notEqual(country.name, 'NA', country.noc);
    assert.notEqual(country.name, 'Boliva', country.noc);
    assert.ok(continents.has(country.continent), `${country.noc}: ${country.continent}`);
    assert.equal(country.flagMode, 'flag-icons', country.noc);
    assert.match(country.iso2, /^[a-z]{2}$/, country.noc);
  }
});

test('buildCountryRegistry refuses an empty registry instead of publishing no countries', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'games28-empty-registry-'));
  const registrySourcePath = join(tempDir, 'registry.json');
  const isoOverridesPath = join(tempDir, 'overrides.json');
  await writeFile(registrySourcePath, JSON.stringify({ countries: [] }));
  await writeFile(isoOverridesPath, JSON.stringify({ overrides: {}, aliases: {} }));
  await assert.rejects(buildCountryRegistry({ registrySourcePath, isoOverridesPath }), /Country registry is empty/);
});
