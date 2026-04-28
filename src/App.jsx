import { useEffect, useMemo, useState } from 'react';
import CountryFlag from './components/CountryFlag.jsx';
import { downloadCalendarEntries } from './lib/ics.js';
import {
  formatCount,
  formatCountdown,
  formatDateLabel,
  formatDateTimeLabel,
  formatLaReference,
  formatStatusLabel,
  formatUpdatedLabel,
  getViewerTimeZoneLabel
} from './lib/format.js';
import { navigate, parseRoute } from './lib/router.js';
import { loadRuntimeDataset, runtimeFallback } from './lib/runtime-data.js';
import {
  buildCountryDashboard,
  buildHomeStats,
  buildScheduleOptions,
  filterCountries,
  filterScheduleEntries
} from './lib/view-models.js';

const DEFAULT_SCHEDULE_FILTERS = {
  sport: 'all',
  dayKey: 'all',
  searchText: ''
};

const DEFAULT_COUNTRY_FILTERS = {
  searchText: '',
  favoriteOnly: false,
  favorites: []
};

const LA28_OPENING_CEREMONY_UTC = '2028-07-15T00:00:00.000Z';

function useStoredState(key, fallbackValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Unable to persist ${key}`, error);
    }
  }, [key, value]);

  return [value, setValue];
}

function AppLink({ href, children, className }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}

function SummaryCard({ label, value, detail }) {
  return (
    <article className="summary-card">
      <p className="eyebrow">{label}</p>
      <strong>{typeof value === 'number' ? formatCount(value) : value}</strong>
      {detail ? <span>{detail}</span> : null}
    </article>
  );
}

function formatChangeEntityLabel(change) {
  if (change.entityType === 'schedule_entry') return 'Schedule';
  if (change.entityType === 'athlete_card') return 'Qualification';
  return change.entityType || 'Update';
}

function SourceRail({ runtime }) {
  const authorityLabel = runtime.meta.scheduleAuthority === 'official_pdf'
    ? 'Official PDF is live'
    : runtime.meta.scheduleAuthority === 'stale_official'
      ? 'Last good official schedule'
      : 'Community fallback is live';

  return (
    <section className="panel source-rail">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Source stack</p>
          <h2>How Games28 is sourcing the data</h2>
        </div>
        <span className="supporting-copy">{authorityLabel}</span>
      </div>
      <div className="source-summary">
        <SummaryCard label="Published schedule" value={runtime.meta.scheduleAuthority?.replace(/_/g, ' ') || 'unknown'} />
        <SummaryCard
          label="Official shadow validation"
          value={runtime.meta.officialValidation?.passed ? 'pass' : 'hold'}
          detail={runtime.meta.officialValidation?.issues?.[0] || `Streak ${runtime.meta.officialShadowSuccessStreak || 0}/3`}
        />
      </div>
      <div className="source-list">
        {runtime.sources.map((source) => (
          <article key={source.id} className="source-card">
            <div className="source-card-top">
              <span className={`tag ${source.kind === 'official' ? 'official' : 'secondary'}`}>{source.kind}</span>
              <span className="source-updated">{formatUpdatedLabel(source.checkedAt || runtime.checkedAt)}</span>
            </div>
            <h3>{source.label}</h3>
            <p>{source.description}</p>
            {source.fallbackUsed ? <p className="source-fallback">Using local snapshot fallback on this refresh.</p> : null}
            <a href={source.url} target="_blank" rel="noreferrer">
              Open source
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function FilterBar({ filters, options, onChange, searchPlaceholder }) {
  const viewerTimeZoneLabel = getViewerTimeZoneLabel();

  return (
    <>
      <div className="timezone-note">
        Times are shown in your local timezone: <strong>{viewerTimeZoneLabel}</strong>. Each session also shows an LA reference time.
      </div>
      <div className="filters-grid">
        <label>
          <span>Sport</span>
          <select value={filters.sport} onChange={(event) => onChange({ ...filters, sport: event.target.value })}>
            <option value="all">All sports</option>
            {options.sportOptions.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Date</span>
          <select value={filters.dayKey} onChange={(event) => onChange({ ...filters, dayKey: event.target.value })}>
            <option value="all">All competition days</option>
            {options.dayOptions.map((dayKey) => (
              <option key={dayKey} value={dayKey}>
                {dayKey}
              </option>
            ))}
          </select>
        </label>
        <label className="search-field">
          <span>Search</span>
          <input
            type="search"
            value={filters.searchText}
            placeholder={searchPlaceholder}
            onChange={(event) => onChange({ ...filters, searchText: event.target.value })}
          />
        </label>
      </div>
    </>
  );
}

function CountryDirectory({ countries, athleteCards, favorites, onToggleFavorite }) {
  const qualificationCountByNoc = useMemo(() => {
    return athleteCards.reduce((accumulator, card) => {
      accumulator.set(card.noc, (accumulator.get(card.noc) || 0) + 1);
      return accumulator;
    }, new Map());
  }, [athleteCards]);

  return (
    <div className="country-grid">
      {countries.map((country) => {
        const count = qualificationCountByNoc.get(country.noc) || 0;
        return (
          <article key={country.noc} className="country-card">
            <div className="country-card-top">
              <div>
                <CountryFlag country={country} />
                <h3>{country.name}</h3>
              </div>
              <button
                type="button"
                className={`favorite-toggle ${favorites.includes(country.noc) ? 'active' : ''}`}
                onClick={() => onToggleFavorite(country.noc)}
              >
                {favorites.includes(country.noc) ? 'Saved' : 'Save'}
              </button>
            </div>
            <p>{country.noc} · {country.continent}</p>
            <div className="country-card-actions">
              <AppLink href={`/countries/${country.noc}`} className="text-link">
                Open dashboard
              </AppLink>
              <span>{count ? `${count} tracked qualification cards` : 'Qualification feed pending'}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ScheduleCard({ entry, countryMode = false }) {
  return (
    <article className="schedule-card">
      <div className="schedule-card-top">
        <div>
          <p className="eyebrow">{entry.sport}</p>
          <h3>{entry.eventName}</h3>
        </div>
        <span className={`tag ${entry.derivedStatus === 'confirmed' ? 'confirmed' : entry.derivedStatus === 'pending' ? 'pending' : 'scheduled'}`}>
          {formatStatusLabel(entry.derivedStatus || entry.status)}
        </span>
      </div>
      <p className="schedule-meta">{entry.phase} · {entry.venue || 'Venue TBC'} · {entry.sessionCode || 'Session TBD'}</p>
      {countryMode && entry.linkedQualificationLabel ? (
        <p className="linked-note">Matched from {entry.linkedQualificationLabel}</p>
      ) : null}
      <div className="time-grid">
        <div>
          <span className="time-label">Your time</span>
          <strong>{formatDateTimeLabel(entry.startAtUtc)}</strong>
        </div>
        <div>
          <span className="time-label">LA reference</span>
          <strong>{formatLaReference(entry.startAtUtc)}</strong>
        </div>
      </div>
      <div className="schedule-card-footer">
        <span>{formatDateLabel(entry.startAtUtc)}</span>
        <div className="schedule-card-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => downloadCalendarEntries([entry], `${entry.sessionCode || 'session'}-games28`)}
            disabled={!entry.startAtUtc}
          >
            Add to calendar
          </button>
          <a href={entry.sourceUrl} target="_blank" rel="noreferrer">
            Source
          </a>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function CountdownCard({ targetIso }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const countdown = formatCountdown(targetIso, now);

  return (
    <div className="countdown-card">
      <p className="eyebrow">Countdown</p>
      <h2>{countdown.label}</h2>
      <p>Until the Opening Ceremony on {formatDateTimeLabel(targetIso, { timeZone: 'America/Los_Angeles' })} LA time.</p>
    </div>
  );
}

function HomeView({
  runtime,
  scheduleFilters,
  onScheduleFiltersChange,
  scheduleEntries,
  scheduleOptions,
  homeStats,
  countryFilters,
  onCountryFiltersChange,
  countries,
  favorites,
  onToggleFavorite
}) {
  const [visibleCountryCount, setVisibleCountryCount] = useState(48);

  useEffect(() => {
    setVisibleCountryCount(48);
  }, [countryFilters.searchText, countryFilters.favoriteOnly]);

  const featuredCountries = countries.slice(0, 3);
  const favoriteCountryCards = countries.filter((country) => favorites.includes(country.noc)).slice(0, 6);
  const shouldShowAllCountries = Boolean(countryFilters.searchText || countryFilters.favoriteOnly);
  const displayedCountries = shouldShowAllCountries ? countries : countries.slice(0, visibleCountryCount);
  const hasHiddenCountries = displayedCountries.length < countries.length;

  function jumpToCountryDashboards() {
    document.getElementById('country-dashboards')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <section className="hero panel">
        <div>
          <p className="eyebrow">Games28</p>
          <h1>The LA 2028 schedule, with country dashboards ready for qualification tracking.</h1>
          <p className="hero-copy">
            Games28 is a global-first planning layer for LA 2028: full competition schedule, saved countries,
            country dashboards, and a refresh pipeline ready for official athlete and quota updates.
          </p>
          <div className="hero-actions">
            <AppLink href="/schedule" className="primary-link">Browse full schedule</AppLink>
            <button type="button" className="secondary-link button-link" onClick={jumpToCountryDashboards}>
              Explore country dashboards
            </button>
            <AppLink href="/changes" className="secondary-link">See recent changes</AppLink>
          </div>
          {featuredCountries.length ? (
            <div className="hero-inline-links">
              <span className="hero-inline-label">Try a dashboard:</span>
              {featuredCountries.map((country) => (
                <AppLink key={country.noc} href={`/countries/${country.noc}`} className="text-link">
                  {country.name}
                </AppLink>
              ))}
            </div>
          ) : null}
        </div>
        <div className="hero-side">
          <CountdownCard targetIso={LA28_OPENING_CEREMONY_UTC} />
          <p className="eyebrow">Update status</p>
          <h2>{formatUpdatedLabel(runtime.checkedAt)}</h2>
          <p>Refresh cadence: {runtime.meta.refreshCadence || 'Daily'}.</p>
          <p>Published source: {runtime.meta.scheduleAuthority?.replace(/_/g, ' ') || 'unknown'}.</p>
          <p>The schedule is live. Qualification cards stay empty until verified athlete or quota updates are added.</p>
          {runtime.meta.staleWarning ? <p>{runtime.meta.staleWarning}</p> : null}
        </div>
      </section>

      <section className="summary-grid">
        {homeStats.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Schedule explorer</p>
            <h2>Scan the entire competition schedule</h2>
          </div>
        <div className="heading-meta">
          <span className="status-pill">Source: {runtime.meta.scheduleAuthority?.replace(/_/g, ' ') || 'unknown'}</span>
            <button
              type="button"
              className="secondary-link button-link"
              onClick={() => downloadCalendarEntries(scheduleEntries, 'games28-schedule')}
              disabled={!scheduleEntries.length}
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
            {scheduleEntries.slice(0, 18).map((entry) => (
              <ScheduleCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No sessions match those filters"
            description="Try resetting the date or sport filter to see the full competition slate."
          />
        )}
      </section>

      <section className="panel" id="country-dashboards">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Country dashboards</p>
            <h2>Open any country dashboard, save favorites, and follow qualification as it lands</h2>
          </div>
          <div className="heading-meta">
            <span className="status-pill">{formatCount(countries.length)} indexed countries</span>
            {!shouldShowAllCountries ? (
              <span className="supporting-copy">{formatCount(displayedCountries.length)} shown</span>
            ) : null}
          </div>
        </div>
        <div className="section-intro">
          Each country card opens its own dashboard with qualification cards, pending vs confirmed sessions, and a country-specific change feed.
        </div>
        <div className="saved-countries-row">
        <div className="saved-countries-label">
            <p className="eyebrow">Saved countries</p>
            <span>{favorites.length ? `${favorites.length} saved` : 'Nothing saved yet'}</span>
          </div>
          <div className="saved-countries-list">
            {favoriteCountryCards.length ? (
              favoriteCountryCards.map((country) => (
                <AppLink key={country.noc} href={`/countries/${country.noc}`} className="saved-country-chip">
                  <CountryFlag country={country} />
                  <span>{country.name}</span>
                </AppLink>
              ))
            ) : (
              <span className="supporting-copy">Save a few favorites and they’ll show up here for quick access.</span>
            )}
          </div>
        </div>
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
              className="secondary-link button-link"
              onClick={() => setVisibleCountryCount((current) => current + 48)}
            >
              Show 48 more countries
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function ScheduleView({ scheduleEntries, scheduleFilters, onScheduleFiltersChange, scheduleOptions }) {
  return (
    <section className="panel page-section">
        <div className="section-heading">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1>Competition schedule</h1>
        </div>
        <div className="heading-meta">
          <span className="status-pill">Local time + LA reference</span>
          <button
            type="button"
            className="secondary-link button-link"
            onClick={() => downloadCalendarEntries(scheduleEntries, 'games28-visible-schedule')}
            disabled={!scheduleEntries.length}
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
          {scheduleEntries.map((entry) => (
            <ScheduleCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No schedule results"
          description="No sessions match those filters yet."
        />
      )}
    </section>
  );
}

function CountryView({ dashboard, favoriteCountries, onToggleFavorite }) {
  const hasQualificationData = dashboard.athleteCards.length > 0;
  const hasConfirmedSessions = dashboard.confirmedSessions.length > 0;

  return (
    <div className="country-layout">
      <section className="hero panel country-hero">
        <div>
          <p className="eyebrow">Country dashboard</p>
          <h1>{dashboard.country.name}</h1>
          <p className="hero-copy">
            {dashboard.country.noc} · {dashboard.country.continent}. This dashboard keeps qualification cards, derived
            schedule matches, and a change feed in one place.
          </p>
          <div className="hero-inline-links">
            <span className="status-pill">Source: derived country view</span>
            <span className="supporting-copy">Confirmed sessions are explicit, pending sessions are best-effort matches.</span>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className={`secondary-link button-link ${favoriteCountries.includes(dashboard.country.noc) ? 'active' : ''}`}
              onClick={() => onToggleFavorite(dashboard.country.noc)}
            >
              {favoriteCountries.includes(dashboard.country.noc) ? 'Saved country' : 'Save country'}
            </button>
            <button
              type="button"
              className="primary-link button-link"
              disabled={!hasConfirmedSessions}
              onClick={() => downloadCalendarEntries(dashboard.confirmedSessions, `${dashboard.country.noc}-games28`)}
            >
              Export confirmed sessions
            </button>
          </div>
        </div>
        <div className="hero-side">
          <CountryFlag country={dashboard.country} className="country-hero-flag" />
          <p className="eyebrow">Latest update</p>
          <h2>{formatUpdatedLabel(dashboard.latestUpdateAt)}</h2>
          <p>{hasQualificationData ? 'Qualification cards are live for this country.' : 'Qualification cards are not populated yet.'}</p>
          <p>{hasConfirmedSessions ? 'Confirmed sessions are ready to export.' : 'Schedule items stay pending until official entry lists appear.'}</p>
          <p className="supporting-copy">
            Confirmed means a country or athlete is explicitly tied to the session. Pending means the schedule match looks likely, but the entry list is not final yet.
          </p>
        </div>
      </section>

      <section className="summary-grid">
        <SummaryCard label="Named athletes" value={dashboard.stats.namedAthleteCount} />
        <SummaryCard label="Quota places" value={dashboard.stats.quotaCount} />
        <SummaryCard label="Confirmed sessions" value={dashboard.stats.confirmedSessionCount} />
        <SummaryCard label="Pending schedule matches" value={dashboard.stats.pendingSessionCount} />
      </section>

      <div className="split-panels">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Qualification cards</p>
              <h2>Named athletes</h2>
            </div>
          </div>
          {dashboard.namedAthletes.length ? (
            <div className="stacked-list">
              {dashboard.namedAthletes.map((card) => (
                <article key={card.id} className="info-card">
                  <div className="info-card-top">
                    <div>
                      <h3>{card.name}</h3>
                      <p>{card.sport}</p>
                    </div>
                    <span className="tag confirmed">{formatStatusLabel(card.status)}</span>
                  </div>
                  <p>{card.disciplines.join(', ')}</p>
                  <div className="info-card-footer">
                    <span>{formatUpdatedLabel(card.lastUpdatedAt)}</span>
                    {card.profileUrl ? (
                      <a href={card.profileUrl} target="_blank" rel="noreferrer">Profile</a>
                    ) : null}
                    {card.sourceUrl ? (
                      <a href={card.sourceUrl} target="_blank" rel="noreferrer">Source</a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No named athletes tracked yet"
              description="This is intentional. Games28 stays empty until a source is verified rather than guessing who is qualified for LA 2028."
            />
          )}
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Qualification cards</p>
              <h2>Quota places without named athletes</h2>
            </div>
          </div>
          {dashboard.quotaPlaces.length ? (
            <div className="stacked-list">
              {dashboard.quotaPlaces.map((card) => (
                <article key={card.id} className="info-card">
                  <div className="info-card-top">
                    <div>
                      <h3>{card.name}</h3>
                      <p>{card.sport}</p>
                    </div>
                    <span className="tag pending">{formatStatusLabel(card.status)}</span>
                  </div>
                  <p>{card.disciplines.join(', ')}</p>
                  <div className="info-card-footer">
                    <span>{formatUpdatedLabel(card.lastUpdatedAt)}</span>
                    {card.sourceUrl ? (
                      <a href={card.sourceUrl} target="_blank" rel="noreferrer">Source</a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No quota places tracked yet"
              description="Add verified quota records to the qualification source file and this panel will light up automatically."
            />
          )}
        </section>
      </div>

      <div className="split-panels">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Country schedule</p>
              <h2>Confirmed sessions</h2>
            </div>
            <span className="status-pill">Confirmed only</span>
          </div>
          {dashboard.confirmedSessions.length ? (
            <div className="schedule-grid compact-grid">
              {dashboard.confirmedSessions.map((entry) => (
                <ScheduleCard key={entry.id} entry={entry} countryMode />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No confirmed sessions yet"
              description="That is normal before final start lists and draws are published. Confirmed sessions will appear here when the source data names this country or athlete explicitly."
            />
          )}
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Country schedule</p>
              <h2>Pending schedule matches</h2>
            </div>
            <span className="status-pill">Awaiting entries</span>
          </div>
          {dashboard.pendingSessions.length ? (
            <div className="schedule-grid compact-grid">
              {dashboard.pendingSessions.slice(0, 12).map((entry) => (
                <ScheduleCard key={entry.id} entry={entry} countryMode />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No pending schedule matches yet"
              description="Once qualification cards are added, Games28 will derive likely sessions from the LA 2028 schedule and keep them marked as pending until entries are confirmed."
            />
          )}
        </section>
      </div>

      <section className="panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Recent changes</p>
            <h2>What moved for {dashboard.country.name}</h2>
          </div>
          <span className="status-pill">Feed by country</span>
        </div>
        {dashboard.changes.length ? (
          <div className="stacked-list">
            {dashboard.changes.map((change) => (
              <article key={change.id} className="change-card">
                <div>
                  <p className="eyebrow">{formatChangeEntityLabel(change)}</p>
                  <h3>{change.summary}</h3>
                  <p>{change.changeType} · {formatUpdatedLabel(change.changedAt)}</p>
                </div>
                <a href={change.sourceUrl} target="_blank" rel="noreferrer">Source</a>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No tracked changes yet"
            description="The first refresh that changes this country's schedule or qualification cards will appear here."
          />
        )}
      </section>
    </div>
  );
}

function ChangesView({ changes }) {
  return (
    <section className="panel page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Change feed</p>
          <h1>Recent schedule and qualification changes</h1>
        </div>
        <span className="supporting-copy">{formatCount(changes.length)} tracked changes</span>
      </div>
      {changes.length ? (
        <div className="stacked-list">
          {changes.map((change) => (
            <article key={change.id} className="change-card large">
              <div>
                <p className="eyebrow">{formatChangeEntityLabel(change)}</p>
                <h3>{change.summary}</h3>
                <p>{change.changeType} · {formatUpdatedLabel(change.changedAt)}</p>
              </div>
              <div className="change-card-actions">
                {change.noc ? <AppLink href={`/countries/${change.noc}`} className="text-link">Open country</AppLink> : null}
                <a href={change.sourceUrl} target="_blank" rel="noreferrer">Source</a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No changes recorded yet"
          description="Once the updater sees a real delta in the schedule or qualification source data, this feed will populate."
        />
      )}
    </section>
  );
}

function NotFoundView() {
  return (
    <section className="panel page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">404</p>
          <h1>That route is not wired yet</h1>
        </div>
      </div>
      <EmptyState
        title="Try the main routes"
        description="Open the home page, schedule explorer, change feed, or a country dashboard from the directory."
      />
    </section>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [runtime, setRuntime] = useState(runtimeFallback);
  const [isLoadingRuntime, setIsLoadingRuntime] = useState(true);
  const [scheduleFilters, setScheduleFilters] = useStoredState('games28-schedule-filters', DEFAULT_SCHEDULE_FILTERS);
  const [favoriteCountries, setFavoriteCountries] = useStoredState('games28-favorite-countries', []);
  const [countryFiltersState, setCountryFiltersState] = useStoredState('games28-country-filters', DEFAULT_COUNTRY_FILTERS);

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [route.name, route.noc]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateRuntime() {
      setIsLoadingRuntime(true);
      const dataset = await loadRuntimeDataset();
      if (!cancelled) {
        setRuntime(dataset);
        setIsLoadingRuntime(false);
      }
    }

    hydrateRuntime();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleEntries = useMemo(() => {
    return filterScheduleEntries(runtime.scheduleEntries || [], scheduleFilters);
  }, [runtime.scheduleEntries, scheduleFilters]);

  const scheduleOptions = useMemo(() => buildScheduleOptions(runtime.scheduleEntries || []), [runtime.scheduleEntries]);
  const homeStats = useMemo(() => buildHomeStats(runtime), [runtime]);

  const countryFilters = {
    ...countryFiltersState,
    favorites: favoriteCountries
  };

  const countries = useMemo(() => {
    return filterCountries(runtime.countries || [], runtime.athleteCards || [], countryFilters);
  }, [runtime.countries, runtime.athleteCards, countryFilters]);

  const currentDashboard = useMemo(() => {
    if (route.name !== 'country') {
      return null;
    }
    return buildCountryDashboard(runtime, route.noc);
  }, [runtime, route]);

  const changes = useMemo(() => {
    return [...(runtime.changes || [])].sort((left, right) => String(right.changedAt).localeCompare(String(left.changedAt)));
  }, [runtime.changes]);

  function toggleFavoriteCountry(noc) {
    setFavoriteCountries((current) => {
      return current.includes(noc) ? current.filter((entry) => entry !== noc) : [...current, noc].sort();
    });
  }

  return (
    <div className="page-shell">
      <div className="backdrop backdrop-top" />
      <div className="backdrop backdrop-bottom" />
      <header className="site-header">
        <AppLink href="/" className="brand-lockup">
          <span className="brand-mark">G28</span>
          <span>
            <strong>Games28</strong>
            <small>LA 2028 schedule and country dashboards</small>
          </span>
        </AppLink>
        <nav className="site-nav">
          <AppLink href="/" className={route.name === 'home' ? 'active' : ''}>Home</AppLink>
          <AppLink href="/schedule" className={route.name === 'schedule' ? 'active' : ''}>Schedule</AppLink>
          <AppLink href="/changes" className={route.name === 'changes' ? 'active' : ''}>Changes</AppLink>
        </nav>
      </header>

      <main className="page-content">
        {isLoadingRuntime ? (
          <section className="panel page-section">
            <EmptyState
              title="Loading the latest Games28 snapshot"
              description="The app is fetching the generated runtime dataset."
            />
          </section>
        ) : null}

        {!isLoadingRuntime && route.name === 'home' ? (
          <HomeView
            runtime={runtime}
            scheduleFilters={scheduleFilters}
            onScheduleFiltersChange={setScheduleFilters}
            scheduleEntries={scheduleEntries}
            scheduleOptions={scheduleOptions}
            homeStats={homeStats}
            countryFilters={countryFilters}
            onCountryFiltersChange={setCountryFiltersState}
            countries={countries}
            favorites={favoriteCountries}
            onToggleFavorite={toggleFavoriteCountry}
          />
        ) : null}

        {!isLoadingRuntime && route.name === 'schedule' ? (
          <ScheduleView
            scheduleEntries={scheduleEntries}
            scheduleFilters={scheduleFilters}
            onScheduleFiltersChange={setScheduleFilters}
            scheduleOptions={scheduleOptions}
          />
        ) : null}

        {!isLoadingRuntime && route.name === 'country' && currentDashboard ? (
          <CountryView
            dashboard={currentDashboard}
            favoriteCountries={favoriteCountries}
            onToggleFavorite={toggleFavoriteCountry}
          />
        ) : null}

        {!isLoadingRuntime && route.name === 'changes' ? <ChangesView changes={changes} /> : null}
        {!isLoadingRuntime && route.name === 'not-found' ? <NotFoundView /> : null}
        {!isLoadingRuntime ? <SourceRail runtime={runtime} /> : null}
      </main>
    </div>
  );
}
