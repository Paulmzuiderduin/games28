import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import { readJson, slugify } from './dataset-utils.mjs';

countries.registerLocale(enLocale);

const IOC_NOC_LIST_URL = 'https://www.olympics.com/ioc/national-olympic-committees';

export async function buildCountryRegistry({ registrySourcePath, isoOverridesPath }) {
  const [registrySource, isoOverrides] = await Promise.all([
    readJson(registrySourcePath, { countries: [], sourceUrl: IOC_NOC_LIST_URL }),
    readJson(isoOverridesPath, { overrides: {}, aliases: {} })
  ]);

  const aliasMap = isoOverrides.aliases || {};
  const isoOverrideMap = isoOverrides.overrides || {};

  return registrySource.countries
    .map((country) => {
      const aliasName = aliasMap[country.name] || country.name;
      const iso2FromName = countries.getAlpha2Code(aliasName, 'en');
      const iso2 = (isoOverrideMap[country.noc] || iso2FromName || null)?.toLowerCase?.() || null;
      return {
        continent: country.continent || 'Undetermined',
        flagMode: iso2 ? 'flag-icons' : 'noc-badge',
        iso2,
        name: country.name,
        noc: country.noc,
        profileSlug: slugify(country.name),
        profileUrl: country.profileUrl || IOC_NOC_LIST_URL,
        sourceUrl: country.sourceUrl || IOC_NOC_LIST_URL
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
