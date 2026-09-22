import { useEffect, useMemo, useState } from 'react';
import AppLink from '../components/AppLink.jsx';
import CountryFlag from '../components/CountryFlag.jsx';
import CountryDirectory from '../components/CountryDirectory.jsx';
import useCountrySearchNoResults from '../hooks/useCountrySearchNoResults.js';
import { formatCount } from '../lib/format.js';

export default function CountriesView({ runtime, countryFilters, onCountryFiltersChange, countries, favorites, onToggleFavorite }) {
  const [visibleCountryCount, setVisibleCountryCount] = useState(48);

  useEffect(() => {
    setVisibleCountryCount(48);
  }, [countryFilters.searchText, countryFilters.favoriteOnly]);

  const savedCountries = useMemo(() => {
    const byNoc = new Map((runtime.countries || []).map((country) => [country.noc, country]));
    return favorites.map((noc) => byNoc.get(noc)).filter(Boolean);
  }, [favorites, runtime.countries]);

  const shouldShowAllCountries = Boolean(countryFilters.searchText || countryFilters.favoriteOnly);
  const displayedCountries = shouldShowAllCountries ? countries : countries.slice(0, visibleCountryCount);
  const hasHiddenCountries = displayedCountries.length < countries.length;
  useCountrySearchNoResults(countryFilters.searchText, countries.length, 'countries');

  return (
    <section className="page-section country-directory-page">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">Countries</p>
          <h1>Country dashboards</h1>
        </div>
        <div className="heading-meta">
          <span className="status-pill">{formatCount(countries.length)} indexed countries</span>
        </div>
      </div>
      <div className="section-intro">
        Pick a country to see its dashboard, save favorites, and follow qualification and schedule updates in one place.
      </div>
      {savedCountries.length ? <div className="saved-countries-row saved-countries-row--editorial">
        <div className="saved-countries-label">
          <p className="eyebrow">Saved countries</p>
          <span>{savedCountries.length} saved</span>
        </div>
        <div className="saved-countries-list">
          {savedCountries.map((country) => (
            <AppLink key={country.noc} href={`/countries/${country.noc}`} className="saved-country-chip">
              <CountryFlag country={country} size="sm" />
              <span>{country.name}</span>
            </AppLink>
          ))}
        </div>
      </div> : null}
      <div className="filters-grid countries-filter-grid">
        <label className="search-field">
          <span>Find a country</span>
          <input
            type="search"
            value={countryFilters.searchText}
            placeholder="Search by name, NOC, or continent"
            onChange={(event) => onCountryFiltersChange({ ...countryFilters, searchText: event.target.value })}
          />
        </label>
        <label className="toggle-row">
          <span>Show saved countries only</span>
          <input
            type="checkbox"
            checked={countryFilters.favoriteOnly}
            onChange={(event) => onCountryFiltersChange({ ...countryFilters, favoriteOnly: event.target.checked })}
          />
        </label>
      </div>
      <CountryDirectory
        countries={displayedCountries}
        athleteCards={runtime.athleteCards}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
      />
      {hasHiddenCountries ? (
        <div className="section-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={() => setVisibleCountryCount((current) => current + 48)}
          >
            Show 48 more countries
          </button>
        </div>
      ) : null}
    </section>
  );
}
