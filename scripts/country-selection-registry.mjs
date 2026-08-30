export function buildCountrySelectionRegistry(countries, overrides = {}) {
  const overridesByNoc = new Map((overrides.sources || []).map((entry) => [entry.noc, entry]));

  return countries.map((country) => {
    const override = overridesByNoc.get(country.noc) || {};
    const officialNocUrl = override.officialNocUrl || null;
    const nationalFederationUrls = Array.isArray(override.nationalFederationUrls)
      ? override.nationalFederationUrls.filter((url) => /^https:\/\//.test(url))
      : [];

    return {
      noc: country.noc,
      countryName: country.name,
      nocAuthorityUrl: country.profileUrl || country.sourceUrl,
      officialNocUrl,
      nationalFederationUrls,
      status: officialNocUrl || nationalFederationUrls.length ? 'configured' : 'awaiting_endpoint'
    };
  });
}

export function toCountrySelectionSources(registry) {
  return registry.flatMap((entry) => {
    const sources = [];
    if (entry.officialNocUrl) {
      sources.push({
        id: `noc-${entry.noc.toLowerCase()}`,
        qualificationSystemKey: null,
        label: `${entry.countryName} NOC`,
        governingBody: entry.countryName,
        sport: null,
        sports: [],
        sourceTier: 'noc',
        kind: 'country_selection',
        status: 'watching',
        rulesUrl: null,
        allocationUrl: entry.officialNocUrl,
        entryUrl: null,
        url: entry.officialNocUrl,
        refreshPolicy: 'daily'
      });
    }
    entry.nationalFederationUrls.forEach((url, index) => {
      sources.push({
        id: `national-federation-${entry.noc.toLowerCase()}-${index + 1}`,
        qualificationSystemKey: null,
        label: `${entry.countryName} national federation`,
        governingBody: entry.countryName,
        sport: null,
        sports: [],
        sourceTier: 'national_federation',
        kind: 'country_selection',
        status: 'watching',
        rulesUrl: null,
        allocationUrl: url,
        entryUrl: null,
        url,
        refreshPolicy: 'daily'
      });
    });
    return sources;
  });
}
