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

  await writeFile(registrySourcePath, JSON.stringify({
    countries: [
      { noc: 'NED', name: 'Netherlands', continent: 'Europe' },
      { noc: 'TPE', name: 'Chinese Taipei', continent: 'Asia' },
      { noc: 'XYZ', name: 'Test Delegation', continent: 'Undetermined' }
    ]
  }));
  await writeFile(isoOverridesPath, JSON.stringify({
    overrides: { TPE: 'TW' },
    aliases: {}
  }));

  const countries = await buildCountryRegistry({ registrySourcePath, isoOverridesPath });
  assert.deepEqual(countries.find((country) => country.noc === 'NED'), {
    continent: 'Europe',
    flagMode: 'flag-icons',
    iso2: 'nl',
    name: 'Netherlands',
    noc: 'NED',
    profileSlug: 'netherlands',
    profileUrl: 'https://www.olympics.com/ioc/national-olympic-committees',
    sourceUrl: 'https://www.olympics.com/ioc/national-olympic-committees'
  });
  assert.equal(countries.find((country) => country.noc === 'TPE')?.iso2, 'tw');
  assert.equal(countries.find((country) => country.noc === 'XYZ')?.flagMode, 'noc-badge');
});
