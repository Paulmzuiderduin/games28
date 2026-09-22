import { useMemo } from 'react';
import AppLink from '../components/AppLink.jsx';
import CountryFlag from '../components/CountryFlag.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SummaryCard from '../components/SummaryCard.jsx';
import { TrustLine } from '../components/ContentLinks.jsx';
import FilterBar from '../components/FilterBar.jsx';
import ScheduleCard from '../components/ScheduleCard.jsx';
import CountdownCard from '../components/CountdownCard.jsx';
import useCountrySearchNoResults from '../hooks/useCountrySearchNoResults.js';
import { getExportableEntries } from '../lib/ics.js';

const LA28_OPENING_CEREMONY_UTC = '2028-07-15T00:00:00.000Z';
const FEATURED_NOCS = ['NED', 'USA', 'JPN', 'GBR', 'AUS', 'FRA'];

export default function HomeView({
  runtime,
  scheduleFilters,
  onScheduleFiltersChange,
  onCalendarExport,
  scheduleEntries,
  scheduleOptions,
  homeStats,
  countryFilters,
  onCountryFiltersChange,
  countries,
  favorites,
  onToggleFavorite
}) {
  const featuredCountries = useMemo(() => {
    const byNoc = new Map((runtime.countries || []).map((country) => [country.noc, country]));
    return FEATURED_NOCS.map((noc) => byNoc.get(noc)).filter(Boolean);
  }, [runtime.countries]);

  const savedCountries = useMemo(() => {
    const byNoc = new Map((runtime.countries || []).map((country) => [country.noc, country]));
    return favorites.map((noc) => byNoc.get(noc)).filter(Boolean);
  }, [favorites, runtime.countries]);

  const displayCountries = countryFilters.searchText || countryFilters.favoriteOnly ? countries.slice(0, 6) : featuredCountries;
  const isSearchingCountries = Boolean(countryFilters.searchText || countryFilters.favoriteOnly);
  useCountrySearchNoResults(countryFilters.searchText, countries.length, 'home');

  return (
    <>
      <div className="home-top-grid">
        <section className="home-intro">
          <p className="eyebrow">LA 2028, in your time zone</p>
          <h1>Follow your country at the Games.</h1>
          <p className="hero-copy">Find a country dashboard for verified qualification updates, session times in your local timezone, and a calendar you can take with you.</p>
          <label className="search-field hero-search">
            <span>Find a country</span>
            <input
              type="search"
              value={countryFilters.searchText}
              placeholder="Search Netherlands, NED, Japan..."
              onChange={(event) => onCountryFiltersChange({ ...countryFilters, searchText: event.target.value })}
            />
          </label>
        </section>
        <aside className="home-discovery" aria-live={isSearchingCountries ? 'polite' : undefined}>
          <div className="section-heading section-heading--flush">
            <div>
              <p className="eyebrow">{isSearchingCountries ? 'Search results' : 'Popular dashboards'}</p>
              <h2>{isSearchingCountries ? 'Choose a country' : 'Start with a country'}</h2>
            </div>
            {!isSearchingCountries ? <AppLink href="/countries" className="text-link">View all</AppLink> : null}
          </div>
          {displayCountries.length ? (
            <div className="featured-country-list">
              {displayCountries.map((country) => (
                <AppLink key={country.noc} href={`/countries/${country.noc}`} className="featured-country-row">
                  <div className="row-main">
                    <CountryFlag country={country} size="md" />
                    <div>
                      <h3>{country.name}</h3>
                      <p>{country.noc} country dashboard</p>
                    </div>
                  </div>
                  <span className="row-arrow" aria-hidden="true">›</span>
                </AppLink>
              ))}
            </div>
          ) : (
            <EmptyState title="No matching countries" description="Try a different country name or NOC code." compact />
          )}
        </aside>
        <div className="home-intro-actions">
        <div className="hero-actions">
          <AppLink href="/countries" className="button-primary">Browse all countries</AppLink>
          <AppLink href="/sports" className="button-secondary">Browse sports</AppLink>
        </div>
        <TrustLine runtime={runtime} />
        </div>
      </div>

      {savedCountries.length ? (
        <section className="saved-countries-row saved-countries-row--editorial">
          <div className="saved-countries-label">
            <p className="eyebrow">Saved countries</p>
            <span>{savedCountries.length} saved</span>
          </div>
          <div className="saved-countries-list">
            {savedCountries.slice(0, 6).map((country) => (
              <AppLink key={country.noc} href={`/countries/${country.noc}`} className="saved-country-chip">
                <CountryFlag country={country} size="sm" />
                <span>{country.name}</span>
              </AppLink>
            ))}
          </div>
        </section>
      ) : null}

      <section className="home-meta-strip">
        <CountdownCard targetIso={LA28_OPENING_CEREMONY_UTC} />
        <div className="home-stats">
          {homeStats.slice(0, 3).map((card) => <SummaryCard key={card.label} {...card} />)}
        </div>
      </section>

      <section className="page-section schedule-preview">
        <div className="section-heading section-heading--flush">
          <div>
            <p className="eyebrow">Schedule preview</p>
            <h2>Explore the competition schedule</h2>
          </div>
          <div className="heading-meta">
            <button
              type="button"
              className="button-secondary"
              onClick={() => onCalendarExport(scheduleEntries.slice(0, 8), 'games28-schedule', 'calendar_export_visible', {
                route: 'home',
                count: scheduleEntries.slice(0, 8).length
              })}
              disabled={!getExportableEntries(scheduleEntries.slice(0, 8)).length}
            >
              Export visible sessions
            </button>
          </div>
        </div>
        <FilterBar
          filters={scheduleFilters}
          options={scheduleOptions}
          onChange={onScheduleFiltersChange}
          searchPlaceholder="Search sport, venue, event, or session code"
        />
        {scheduleEntries.length ? (
          <div className="schedule-grid">
            {scheduleEntries.slice(0, 8).map((entry) => (
              <ScheduleCard key={entry.id} entry={entry} onCalendarExport={onCalendarExport} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No sessions match those filters"
            description="Try resetting the date or sport filter to see the full competition slate."
          />
        )}
      </section>
    </>
  );
}
