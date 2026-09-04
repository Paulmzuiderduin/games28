import { useEffect, useMemo, useRef, useState } from 'react';
import CountryFlag from './components/CountryFlag.jsx';
import AdminReviewConsole from './components/AdminReviewConsole.jsx';
import ReportUpdateForm from './components/ReportUpdateForm.jsx';
import { downloadCalendarEntries } from './lib/ics.js';
import { trackEvent, trackOutboundClick } from './lib/analytics.js';
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
import { isMedalEvent } from './lib/schedule-events.js';
import { getShareUrl, sharePage } from './lib/share.js';
import { loadRuntimeDataset, runtimeFallback } from './lib/runtime-data.js';
import { findSportBySlug, getSessionPath, getSportPath } from './lib/seo.js';
import {
  buildCountryDashboard,
  buildHomeStats,
  buildScheduleOptions,
  buildSportDirectory,
  buildSportQualificationOverview,
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
const KOFI_URL = 'https://ko-fi.com/paulzuiderduin';
const BLUESKY_URL = 'https://bsky.app/profile/games28.bsky.social';
const FEATURED_NOCS = ['NED', 'USA', 'JPN', 'GBR', 'AUS', 'FRA'];
const THEME_PREFERENCE_KEY = 'games28-theme-preference';

const PRIMARY_NAV_ITEMS = [
  { href: '/', routeNames: ['home'], label: 'Home', icon: 'home' },
  { href: '/countries', routeNames: ['countries', 'country'], label: 'Countries', icon: 'flag' },
  { href: '/sports', routeNames: ['sports', 'sport'], label: 'Sports', icon: 'sports' },
  { href: '/schedule', routeNames: ['schedule', 'session'], label: 'Schedule', icon: 'calendar' },
  { href: '/changes', routeNames: ['changes'], label: 'Changes', icon: 'pulse' }
];

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

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function useThemePreference() {
  const [preference, setPreference] = useStoredState(THEME_PREFERENCE_KEY, 'system');
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const theme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setPreference(nextTheme);
    trackEvent('theme_change', { theme: nextTheme, preference: 'manual' });
  }

  function followDeviceTheme() {
    setPreference('system');
    trackEvent('theme_change', { theme: getSystemTheme(), preference: 'system' });
  }

  return { theme, preference, toggleTheme, followDeviceTheme };
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

function NavIcon({ name }) {
  if (name === 'flag') return <span aria-hidden="true">⚑</span>;
  if (name === 'sports') return <span aria-hidden="true">●</span>;
  if (name === 'calendar') return <span aria-hidden="true">□</span>;
  if (name === 'pulse') return <span aria-hidden="true">◌</span>;
  return <span aria-hidden="true">⌂</span>;
}

function SiteNavigation({ routeName, mobile = false }) {
  const navClassName = mobile ? 'mobile-tabbar' : 'desktop-nav';

  return (
    <nav className={navClassName} aria-label="Primary">
      {PRIMARY_NAV_ITEMS.map((item) => {
        const isActive = item.routeNames.includes(routeName);
        const linkClassName = mobile
          ? `mobile-tab ${isActive ? 'active' : ''}`.trim()
          : `desktop-nav-link ${isActive ? 'active' : ''}`.trim();

        return (
          <AppLink
            key={item.href}
            href={item.href}
            className={linkClassName}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </AppLink>
        );
      })}
    </nav>
  );
}

function ThemeToggle({ theme, preference, onToggle, onFollowDevice, compact = false }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <div className={`theme-controls ${compact ? 'theme-controls--compact' : ''}`.trim()}>
      <button
        type="button"
        className="theme-toggle"
        onClick={onToggle}
        aria-label={`Switch to ${nextTheme} mode`}
        title={`Switch to ${nextTheme} mode`}
      >
        <span className="theme-toggle__icon" aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
        {!compact ? <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span> : null}
      </button>
      {!compact && preference !== 'system' ? (
        <button type="button" className="theme-follow-device" onClick={onFollowDevice}>
          Use device setting
        </button>
      ) : null}
    </div>
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

function qualificationDetail(card) {
  const discipline = (card.disciplines || []).join(', ');
  if (card.subjectType !== 'team_quota') return discipline;
  const capacity = card.teamSizeMax ? `Up to ${card.teamSizeMax} athlete-and-horse combinations` : 'Final team not selected yet';
  return [discipline, capacity].filter(Boolean).join(' · ');
}

function sportQualificationStatus(card) {
  const state = String(card.state || '').toLowerCase();

  if (state === 'entered') return 'Final entry confirmed';
  if (state === 'selected') return card.teamType === 'team' ? 'Team selected' : 'Athlete selected';
  if (card.status === 'named') return card.teamType === 'team' ? 'Named team' : 'Named athlete';
  if (state === 'earned') return 'Qualification earned';
  return 'Quota allocated';
}

function isNamedQualification(card) {
  return card.status === 'named' || ['selected', 'entered'].includes(card.state);
}

function KofiLink({ className = 'text-link', children = 'Support Games28 on Ko-fi' }) {
  return (
    <a
      href={KOFI_URL}
      className={className}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackOutboundClick('kofi_click', KOFI_URL)}
    >
      {children}
    </a>
  );
}

function BlueskyLink({ className = 'text-link', children = 'Follow on Bluesky' }) {
  return (
    <a
      href={BLUESKY_URL}
      className={className}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackOutboundClick('bluesky_click', BLUESKY_URL)}
    >
      {children}
    </a>
  );
}

function SourceLink({ href, children = 'Source', context = {}, className = '' }) {
  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackOutboundClick('source_click', href, context)}
    >
      {children}
    </a>
  );
}

function ShareButton({ title, text, path, context = {}, className = 'text-button', children = 'Share' }) {
  const [feedback, setFeedback] = useState('');

  async function handleShare() {
    const result = await sharePage({ title, text, url: getShareUrl(path) });

    if (result.status === 'shared') {
      trackEvent('page_share', { ...context, method: result.method });
      setFeedback(result.method === 'copy' ? 'Link copied' : 'Shared');
      window.setTimeout(() => setFeedback(''), 2200);
      return;
    }

    if (result.status === 'unavailable') {
      setFeedback('Sharing is unavailable');
      window.setTimeout(() => setFeedback(''), 2200);
    }
  }

  return (
    <span className="share-control">
      <button type="button" className={className} onClick={handleShare}>
        {children}
      </button>
      {feedback ? <span className="share-feedback" aria-live="polite">{feedback}</span> : null}
    </span>
  );
}

function SupportCta({ onDismiss }) {
  return (
    <section className="support-cta">
      <div>
        <p className="eyebrow">Free forever</p>
        <h2>Calendar exported. If Games28 helped, Ko-fi keeps it running.</h2>
      </div>
      <div className="support-cta-actions">
        <KofiLink className="button-primary">Support on Ko-fi</KofiLink>
        <button type="button" className="text-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

function getScheduleAuthorityLabel(runtime) {
  return runtime.meta.scheduleAuthority === 'official_pdf'
    ? 'Official schedule'
    : runtime.meta.scheduleAuthority === 'stale_official'
      ? 'Last verified official schedule'
      : 'Community schedule reference';
}

function TrustLine({ runtime, className = '' }) {
  return (
    <div className={`trust-line ${className}`.trim()}>
      <span className="trust-line__dot" aria-hidden="true" />
      <span>{getScheduleAuthorityLabel(runtime)}</span>
      <span aria-hidden="true">·</span>
      <span>{formatUpdatedLabel(runtime.checkedAt)}</span>
      <AppLink href="/sources" className="trust-line__link">Data & sources</AppLink>
    </div>
  );
}

function SourcesView({ runtime }) {
  const authorityLabel = runtime.meta.scheduleAuthority === 'official_pdf'
    ? 'Official PDF is live'
    : runtime.meta.scheduleAuthority === 'stale_official'
      ? 'Last good official schedule'
      : 'Community fallback is live';
  const officialValidationStreak = runtime.meta.officialShadowSuccessStreak || 0;
  const officialValidationTarget = 3;
  const officialValidationRemaining = Math.max(0, officialValidationTarget - officialValidationStreak);
  const qualificationCoverage = runtime.meta.qualificationCoverage || {};
  const countrySelectionCoverage = runtime.meta.countrySelectionCoverage || {};
  const qualificationSources = runtime.meta.qualificationSources || [];
  const activeQualificationSources = qualificationSources.filter((source) => source.status !== 'watching');

  return (
    <section className="page-section sources-page">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Data & sources</p>
          <h1>How Games28 verifies its data</h1>
          <p className="section-intro section-intro--flush">We publish confirmed information, not predictions. Detailed source health stays here so the schedule and country dashboards can remain easy to scan.</p>
        </div>
        <span className="status-pill">{authorityLabel}</span>
      </div>
      <div className="source-summary">
        <SummaryCard label="Published schedule" value={runtime.meta.scheduleAuthority?.replace(/_/g, ' ') || 'unknown'} />
        <SummaryCard
          label="Official PDF check"
          value={runtime.meta.officialValidation?.passed ? 'Passed' : 'Needs review'}
          detail={runtime.meta.officialValidation?.passed
            ? `${officialValidationStreak} of ${officialValidationTarget} successful checks recorded before the parser is trusted automatically.`
            : runtime.meta.officialValidation?.issues?.[0] || `${officialValidationRemaining} successful checks still needed before promotion.`}
        />
        <SummaryCard
          label="Qualification systems"
          value={`${qualificationCoverage.coveredSportCount || 0} schedule labels covered`}
          detail={`${qualificationCoverage.systemCount || 0} official sport groups are checked daily. No predictions are published.`}
        />
        <SummaryCard
          label="Country selection sources"
          value={`${countrySelectionCoverage.configuredCount || 0}/${countrySelectionCoverage.countryCount || runtime.countries.length || 0} configured`}
          detail="Every IOC NOC has a source slot; unavailable endpoints stay explicitly unavailable."
        />
        <SummaryCard
          label="Automatic qualification scan"
          value={`${runtime.meta.qualificationSourceScanCount || 0} official sources checked`}
          detail={runtime.meta.qualificationAutoRecordCount
            ? `${runtime.meta.qualificationAutoRecordCount} structured records passed automatic validation.`
            : 'Only complete official allocation tables publish automatically; prose stays in review.'}
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
            <SourceLink href={source.url} context={{ sourceId: source.id }}>
              Open source
            </SourceLink>
          </article>
        ))}
      </div>
      {qualificationSources.length ? (
        <div className="qualification-source-list">
          <p className="eyebrow">Qualification source coverage</p>
          <p className="supporting-copy">A source being watched is not a qualification record. Only dated, official allocations, selections, and final entries appear on country dashboards.</p>
          <div className="source-list">
            {activeQualificationSources.map((source) => (
              <article key={source.id} className="source-card">
                <div className="source-card-top">
                  <span className="tag official">{source.status.replace(/_/g, ' ')}</span>
                  <span className="source-updated">{source.sports?.length || 1} sport{source.sports?.length === 1 ? '' : 's'}</span>
                </div>
                <h3>{source.label}</h3>
                <p>{source.status === 'review_required' ? 'Official announcements are queued for human review before publication.' : 'Records publish only after an explicit allocation, selection, or final entry.'}</p>
                <SourceLink href={source.url} context={{ sourceId: source.id }}>
                  Open source
                </SourceLink>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SiteFooter({ theme, themePreference, onToggleTheme, onFollowDeviceTheme }) {
  return (
    <footer className="site-footer">
      <p>Games28 is an independent fan-made schedule tracker and is not affiliated with LA28, the IOC, or the Olympic Games.</p>
      <div className="site-footer__links">
        <AppLink href="/sources">Data & sources</AppLink>
        <AppLink href="/report">Report an update</AppLink>
        <BlueskyLink />
        <KofiLink>Support Games28</KofiLink>
        <ThemeToggle
          theme={theme}
          preference={themePreference}
          onToggle={onToggleTheme}
          onFollowDevice={onFollowDeviceTheme}
        />
      </div>
    </footer>
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
              <div className="country-card-identity">
                <CountryFlag country={country} size="md" />
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
              <span>{count ? `${count} confirmed qualification records` : 'No confirmed records yet'}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function useCountrySearchNoResults(searchText, resultCount, location) {
  const lastTrackedQuery = useRef('');

  useEffect(() => {
    const query = searchText.trim().toLocaleLowerCase();
    if (!query || resultCount > 0) {
      lastTrackedQuery.current = '';
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (lastTrackedQuery.current === query) return;
      // Keep the searched text private; the aggregate event is enough to spot a discovery problem.
      trackEvent('country_search_no_results', { location });
      lastTrackedQuery.current = query;
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [location, resultCount, searchText]);
}

function ScheduleCard({ entry, countryMode = false, onCalendarExport }) {
  const medalEvent = isMedalEvent(entry);

  return (
    <article className={`schedule-card ${countryMode ? 'schedule-card--country' : ''}`.trim()}>
      <div className="schedule-card-top">
        <div>
          <p className="eyebrow">
            <AppLink href={getSportPath(entry.sport)} className="eyebrow-link">{entry.sport}</AppLink>
          </p>
          <h3>{entry.eventName}</h3>
          <p className="schedule-meta">{entry.venue || 'Venue TBC'}</p>
        </div>
        <div className="schedule-card-badges">
          {medalEvent ? (
            <span className="medal-badge" title="Medal event" aria-label="Medal event">
              <span className="medal-badge__icon" aria-hidden="true" />
              <span>Medal</span>
            </span>
          ) : null}
          <span className={`tag ${entry.derivedStatus === 'confirmed' ? 'confirmed' : entry.derivedStatus === 'pending' ? 'pending' : 'scheduled'}`}>
            {formatStatusLabel(entry.derivedStatus || entry.status)}
          </span>
        </div>
      </div>
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
      <div className="schedule-card-details">
        <span>{entry.sessionCode || 'Session TBD'}</span>
        <span>{formatDateLabel(entry.startAtUtc)}</span>
      </div>
      <div className="schedule-card-footer">
        <div className="schedule-card-actions">
          <button
            type="button"
            className="text-button schedule-card-action"
            onClick={() => onCalendarExport?.([entry], `${entry.sessionCode || 'session'}-games28`, 'calendar_export_session', {
              sessionId: entry.id,
              sport: entry.sport
            })}
            disabled={!entry.startAtUtc}
          >
            Add to calendar
          </button>
          <AppLink href={getSessionPath(entry.id)} className="text-link schedule-card-action">Details</AppLink>
          <ShareButton
            title={`${entry.eventName} | Games28`}
            text={`${entry.sport} at LA 2028: ${entry.eventName}.`}
            path={getSessionPath(entry.id)}
            context={{ entityType: 'session', sessionId: entry.id, sport: entry.sport }}
            className="text-button schedule-card-action"
          />
          <SourceLink href={entry.sourceUrl} context={{ sessionId: entry.id, sport: entry.sport }} className="schedule-card-action schedule-card-source-link" />
        </div>
      </div>
    </article>
  );
}

function EmptyState({ title, description, compact = false }) {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''}`}>
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
              onClick={() => onCalendarExport(scheduleEntries, 'games28-schedule', 'calendar_export_visible', {
                route: 'home',
                count: scheduleEntries.length
              })}
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

function CountriesView({ runtime, countryFilters, onCountryFiltersChange, countries, favorites, onToggleFavorite }) {
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

function ScheduleView({ runtime, scheduleEntries, scheduleFilters, onScheduleFiltersChange, scheduleOptions, onCalendarExport }) {
  return (
    <section className="page-section">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1>Competition schedule</h1>
        </div>
        <div className="heading-meta">
          <span className="status-pill">Local time + LA reference</span>
          <AppLink href="/sports" className="text-link">Browse sports</AppLink>
          <button
            type="button"
            className="button-secondary"
            onClick={() => onCalendarExport(scheduleEntries, 'games28-visible-schedule', 'calendar_export_visible', {
              route: 'schedule',
              count: scheduleEntries.length
            })}
            disabled={!scheduleEntries.length}
          >
            Export visible sessions
          </button>
        </div>
      </div>
      <TrustLine runtime={runtime} className="trust-line--section" />
      <FilterBar
        filters={scheduleFilters}
        options={scheduleOptions}
        onChange={onScheduleFiltersChange}
        searchPlaceholder="Search sport, venue, event, or session code"
      />
      {scheduleEntries.length ? (
        <div className="schedule-grid">
          {scheduleEntries.map((entry) => (
            <ScheduleCard key={entry.id} entry={entry} onCalendarExport={onCalendarExport} />
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

function SportsView({ sports }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSports = normalizedQuery
    ? sports.filter((sport) => sport.sport.toLowerCase().includes(normalizedQuery))
    : sports;

  return (
    <section className="page-section sports-directory-page">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">Sports</p>
          <h1>Find your sport</h1>
        </div>
        <span className="status-pill">{formatCount(sports.length)} sports</span>
      </div>
      <p className="section-intro section-intro--flush">
        Open a sport page for its schedule, local session times, and confirmed qualification records.
      </p>
      <label className="search-field sport-directory-search">
        <span>Search sports</span>
        <input
          type="search"
          value={query}
          placeholder="Swimming, volleyball, athletics..."
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {filteredSports.length ? (
        <div className="sport-directory-grid">
          {filteredSports.map((sport) => (
            <AppLink key={sport.sport} href={getSportPath(sport.sport)} className="sport-directory-card">
              <div>
                <p className="eyebrow">{formatCount(sport.sessionCount)} sessions</p>
                <h2>{sport.sport}</h2>
                <p>{sport.qualificationRecordCount
                  ? `${sport.qualificationRecordCount} confirmed qualification ${sport.qualificationRecordCount === 1 ? 'record' : 'records'} across ${sport.qualificationCountryCount} ${sport.qualificationCountryCount === 1 ? 'country' : 'countries'}`
                  : 'Qualification records publish when officially confirmed'}</p>
              </div>
              <span className="row-arrow" aria-hidden="true">›</span>
            </AppLink>
          ))}
        </div>
      ) : (
        <EmptyState compact title="No matching sports" description="Try a broader sport name." />
      )}
    </section>
  );
}

function SportQualificationOverview({ overview, sport }) {
  return (
    <section className="sport-qualification-section">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">Qualification</p>
          <h2>Confirmed qualification</h2>
          <p className="supporting-copy">Official quota places and named athletes or teams, grouped by event. No rankings or predictions.</p>
        </div>
        {overview.cards.length ? <span className="status-pill">{formatCount(overview.stats.countryCount)} countries</span> : null}
      </div>

      {overview.groups.length ? (
        <div className="sport-qualification-groups">
          {overview.groups.map((group) => (
            <section key={group.id} className="sport-qualification-group">
              <div className="sport-qualification-group__heading">
                <h3>{group.label}</h3>
                <span>{formatCount(group.countryCount)} {group.countryCount === 1 ? 'country' : 'countries'}</span>
              </div>
              <div className="sport-qualification-list">
                {group.cards.map((card) => (
                  <article key={card.id} className="sport-qualification-record">
                    <div className="sport-qualification-record__country">
                      <CountryFlag country={card.country} size="md" />
                      <AppLink href={`/countries/${card.noc}`} className="sport-qualification-record__country-link">
                        {card.country.name}
                      </AppLink>
                    </div>
                    <div className="sport-qualification-record__details">
                      <strong>{card.name}</strong>
                      <span>{qualificationDetail(card)}</span>
                    </div>
                    <div className="sport-qualification-record__meta">
                      <span className={`tag ${isNamedQualification(card) ? 'confirmed' : 'pending'}`}>
                        {sportQualificationStatus(card)}
                      </span>
                      <span>{formatUpdatedLabel(card.lastUpdatedAt)}</span>
                      {card.sourceUrl ? (
                        <SourceLink href={card.sourceUrl} context={{ sport, noc: card.noc, qualificationId: card.id }} />
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          compact
          title={`No confirmed ${sport} qualification records yet`}
          description="Games28 will list a country, athlete, or team here only after an official source confirms the allocation, selection, or final entry."
        />
      )}
    </section>
  );
}

function SportView({ runtime, sport, entries, scheduleFilters, onScheduleFiltersChange, scheduleOptions, onCalendarExport }) {
  const qualificationOverview = useMemo(
    () => (sport ? buildSportQualificationOverview(runtime, sport) : { cards: [], groups: [], stats: {} }),
    [runtime, sport]
  );

  if (!sport) {
    return (
      <section className="page-section">
        <EmptyState
          title="Sport not found"
          description="Open the schedule explorer to choose one of the sports currently indexed by Games28."
        />
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">Sport schedule</p>
          <h1>{sport}</h1>
        </div>
        <div className="heading-meta">
          <span className="status-pill">{formatCount(entries.length)} sessions</span>
          <button
            type="button"
            className="button-secondary"
            onClick={() => onCalendarExport(entries, `${sport}-games28`, 'calendar_export_visible', {
              route: 'sport',
              sport,
              count: entries.length
            })}
            disabled={!entries.length}
          >
            Export sport schedule
          </button>
        </div>
      </div>
      <TrustLine runtime={runtime} className="trust-line--section" />
      <div className="page-utility-actions">
        <AppLink href="/sports" className="text-link">Browse all sports</AppLink>
        <ShareButton
          title={`${sport} LA 2028 schedule | Games28`}
          text={`Browse the ${sport} schedule for LA 2028 in your local time.`}
          path={getSportPath(sport)}
          context={{ entityType: 'sport', sport }}
        >
          Share {sport} schedule
        </ShareButton>
      </div>
      <SportQualificationOverview overview={qualificationOverview} sport={sport} />
      <section className="sport-sessions-section">
        <div className="section-heading section-heading--flush">
          <div>
            <p className="eyebrow">Schedule</p>
            <h2>{sport} sessions</h2>
          </div>
        </div>
        <div className="timezone-note">
          Times are shown in your local timezone: <strong>{getViewerTimeZoneLabel()}</strong>. Each session also shows an LA reference time.
        </div>
        <div className="filters-grid sport-filter-grid">
          <label>
            <span>Date</span>
            <select value={scheduleFilters.dayKey} onChange={(event) => onScheduleFiltersChange({ ...scheduleFilters, dayKey: event.target.value })}>
              <option value="all">All competition days</option>
              {scheduleOptions.dayOptions.map((dayKey) => (
                <option key={dayKey} value={dayKey}>
                  {dayKey}
                </option>
              ))}
            </select>
          </label>
          <label className="search-field">
            <span>Search {sport}</span>
            <input
              type="search"
              value={scheduleFilters.searchText}
              placeholder={`Search ${sport} sessions, venues, or session codes`}
              onChange={(event) => onScheduleFiltersChange({ ...scheduleFilters, searchText: event.target.value })}
            />
          </label>
        </div>
        {entries.length ? (
          <div className="schedule-grid">
            {entries.map((entry) => (
              <ScheduleCard key={entry.id} entry={entry} onCalendarExport={onCalendarExport} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No sessions match those filters"
            description="Try clearing the date or text search to see the full sport schedule."
          />
        )}
      </section>
    </section>
  );
}

function SessionView({ runtime, entry, onCalendarExport }) {
  if (!entry) {
    return (
      <section className="page-section">
        <EmptyState
          title="Session not found"
          description="Open the schedule explorer to choose a currently indexed session."
        />
      </section>
    );
  }

  return (
    <section className="page-section session-detail">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">{entry.sport}</p>
          <h1>{entry.eventName}</h1>
        </div>
        <div className="heading-meta">
          <span className="status-pill">{entry.sessionCode || 'Session TBD'}</span>
          <button
            type="button"
            className="button-secondary"
            onClick={() => onCalendarExport([entry], `${entry.sessionCode || entry.id}-games28`, 'calendar_export_session', {
              route: 'session',
              sessionId: entry.id,
              sport: entry.sport
            })}
            disabled={!entry.startAtUtc}
          >
            Add to calendar
          </button>
        </div>
      </div>
      <TrustLine runtime={runtime} className="trust-line--section" />
      <div className="session-detail-body">
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
        <div className="session-facts">
          <SummaryCard label="Venue" value={entry.venue || 'Venue TBC'} />
          <SummaryCard label="Date" value={formatDateLabel(entry.startAtUtc)} />
        </div>
        <div className="session-links">
          <AppLink href={getSportPath(entry.sport)} className="text-link">Open {entry.sport} schedule</AppLink>
          <AppLink href="/schedule" className="text-link">Browse all sessions</AppLink>
          <ShareButton
            title={`${entry.eventName} | Games28`}
            text={`${entry.sport} at LA 2028: ${entry.eventName}.`}
            path={getSessionPath(entry.id)}
            context={{ entityType: 'session', sessionId: entry.id, sport: entry.sport }}
          >
            Share this session
          </ShareButton>
          <SourceLink href={entry.sourceUrl} context={{ sessionId: entry.id, sport: entry.sport }} />
        </div>
      </div>
    </section>
  );
}

function CountryView({ runtime, dashboard, favoriteCountries, onToggleFavorite, onCalendarExport }) {
  const hasQualificationData = dashboard.athleteCards.length > 0;
  const hasConfirmedSessions = dashboard.confirmedSessions.length > 0;

  return (
    <section className="country-page">
      <div className="country-page__hero">
        <div className="country-page__head">
          <div className="country-page__identity">
            <CountryFlag country={dashboard.country} size="lg" className="country-hero-flag" />
            <div>
              <p className="eyebrow">Country dashboard</p>
              <h1>{dashboard.country.name}</h1>
              <p className="hero-copy">{dashboard.country.noc} · {dashboard.country.continent}</p>
            </div>
          </div>
          <div className="country-page__actions">
            <button
              type="button"
              className={`button-secondary ${favoriteCountries.includes(dashboard.country.noc) ? 'active' : ''}`}
              onClick={() => onToggleFavorite(dashboard.country.noc)}
            >
              {favoriteCountries.includes(dashboard.country.noc) ? 'Saved country' : 'Save country'}
            </button>
            <button
              type="button"
              className="button-primary"
              disabled={!hasConfirmedSessions}
              onClick={() => onCalendarExport(dashboard.confirmedSessions, `${dashboard.country.noc}-games28`, 'calendar_export_country', {
                noc: dashboard.country.noc,
                count: dashboard.confirmedSessions.length
              })}
            >
              Export confirmed sessions
            </button>
          </div>
        </div>
        <p className="country-page__intro">
          Games28 shows confirmation only: an official quota, an officially selected athlete, or a final Games entry. It never predicts a roster from rankings.
        </p>
        <TrustLine runtime={runtime} />
        <div className="country-page__utility">
          <ShareButton
            title={`${dashboard.country.name} at LA 2028 | Games28`}
            text={`Follow ${dashboard.country.name}'s LA 2028 qualification updates and schedule in your local time.`}
            path={`/countries/${dashboard.country.noc}`}
            context={{ entityType: 'country', noc: dashboard.country.noc }}
          >
            Share dashboard
          </ShareButton>
        </div>
      </div>

      <section className="summary-grid country-page__stats">
        <SummaryCard label="Confirmed athletes / teams" value={dashboard.stats.namedAthleteCount} />
        <SummaryCard label="Confirmed quota places" value={dashboard.stats.quotaCount} />
        <SummaryCard label="Confirmed sessions" value={dashboard.stats.confirmedSessionCount} />
        <SummaryCard label="Entries awaiting draw" value={dashboard.stats.awaitingScheduleGroupCount} />
      </section>

      {Date.now() >= new Date(LA28_OPENING_CEREMONY_UTC).getTime() - 7 * 24 * 60 * 60 * 1000 ? (
        <section className="panel country-page__medals">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Performance</p>
              <h2>Medal tally</h2>
            </div>
            <span className="status-pill">Live updates</span>
          </div>
          <div className="medal-grid">
            <div className="medal-item">
              <div className="medal-circle gold">G</div>
              <div className="medal-info">
                <span className="medal-label">Gold</span>
                <strong className="medal-count">{dashboard.country.medals?.gold || 0}</strong>
              </div>
            </div>
            <div className="medal-item">
              <div className="medal-circle silver">S</div>
              <div className="medal-info">
                <span className="medal-label">Silver</span>
                <strong className="medal-count">{dashboard.country.medals?.silver || 0}</strong>
              </div>
            </div>
            <div className="medal-item">
              <div className="medal-circle bronze">B</div>
              <div className="medal-info">
                <span className="medal-label">Bronze</span>
                <strong className="medal-count">{dashboard.country.medals?.bronze || 0}</strong>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="country-page__body">
        <div className="country-page__main">
          <section className="panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Country schedule</p>
                <h2>Next sessions</h2>
              </div>
              <span className="status-pill">Confirmed first</span>
            </div>
            {dashboard.confirmedSessions.length ? (
              <div className="schedule-grid compact-grid">
                {dashboard.confirmedSessions.map((entry) => (
                  <ScheduleCard key={entry.id} entry={entry} countryMode onCalendarExport={onCalendarExport} />
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                title="No confirmed sessions yet"
                description="Entry lists are not final. Confirmed sessions will appear here as country data is published."
              />
            )}
          </section>

          <section className="panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Qualification</p>
                <h2>Confirmed athletes and teams</h2>
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
                      <span className="tag confirmed">{formatStatusLabel(card.state || card.status)}</span>
                    </div>
                    <p>{qualificationDetail(card)}</p>
                    <div className="info-card-footer">
                      <span>{formatUpdatedLabel(card.lastUpdatedAt)}</span>
                      {card.profileUrl ? (
                        <SourceLink href={card.profileUrl} context={{ noc: card.noc, athleteId: card.id }}>
                          Profile
                        </SourceLink>
                      ) : null}
                      {card.sourceUrl ? (
                        <SourceLink href={card.sourceUrl} context={{ noc: card.noc, athleteId: card.id }} />
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                title="No confirmed athletes or teams yet"
                description="A person appears only after an official federation, NOC, or IOC source confirms their qualification, selection, or final entry."
              />
            )}
          </section>

          <section className="panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Qualification</p>
                <h2>Confirmed quota places awaiting selection</h2>
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
                      <span className="tag pending">{formatStatusLabel(card.state || card.status)}</span>
                    </div>
                    <p>{qualificationDetail(card)}</p>
                    <div className="info-card-footer">
                      <span>{formatUpdatedLabel(card.lastUpdatedAt)}</span>
                      {card.sourceUrl ? (
                        <SourceLink href={card.sourceUrl} context={{ noc: card.noc, athleteId: card.id }} />
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                title="No confirmed quota places yet"
                description="A quota appears only after the IOC, International Federation, or NOC publishes the allocation."
              />
            )}
          </section>
        </div>

        <aside className="country-page__aside">
          <section className="panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Schedule status</p>
                <h2>Awaiting official draw</h2>
              </div>
            </div>
            {dashboard.awaitingScheduleGroups.length ? (
              <div className="stacked-list">
                {dashboard.awaitingScheduleGroups.map((group) => (
                  <article key={group.id} className="info-card">
                    <div className="info-card-top">
                      <div>
                        <h3>{group.sport}</h3>
                        <p>{group.disciplines.join(', ') || 'Qualified entry'}</p>
                      </div>
                      <span className="tag pending">Awaiting draw</span>
                    </div>
                    <p className="awaiting-entry-note">
                      {group.entryCount} qualified {group.entryCount === 1 ? 'entry is' : 'entries are'} awaiting an official draw or final entry list. Possible sessions are not shown as a country schedule.
                    </p>
                    <div className="info-card-footer">
                      <AppLink href={getSportPath(group.sport)} className="text-link">Open {group.sport} schedule</AppLink>
                      {group.sourceUrl ? <SourceLink href={group.sourceUrl} context={{ noc: dashboard.country.noc, sport: group.sport }} /> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                title="No entries awaiting a draw"
                description="When an official draw or entry list names this country, the exact sessions will appear above."
              />
            )}
          </section>

          <section className="panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Data status</p>
                <h2>Source and freshness</h2>
              </div>
            </div>
            <div className="stacked-list">
              <article className="info-card">
                <h3>{formatUpdatedLabel(dashboard.latestUpdateAt)}</h3>
                <p>{hasQualificationData ? 'Every qualification card has a dated official source.' : 'No confirmed qualification records have been published yet.'}</p>
              </article>
              <article className="info-card">
                <h3>{hasConfirmedSessions ? 'Confirmed sessions ready' : 'Waiting for entry lists'}</h3>
                <p>{hasConfirmedSessions ? 'Confirmed sessions can be exported now.' : 'Games28 does not list possible sessions. Exact sessions appear only after an official draw or entry list.'}</p>
              </article>
              <article className="info-card">
                <h3>{runtime.countrySelectionRegistry?.find((entry) => entry.noc === dashboard.country.noc)?.status === 'configured' ? 'Official selection source configured' : 'Official selection source slot reserved'}</h3>
                <p>{runtime.countrySelectionRegistry?.find((entry) => entry.noc === dashboard.country.noc)?.status === 'configured' ? 'Games28 watches the listed NOC or national federation source for confirmed selections.' : 'No official country selection endpoint has been added yet. This never creates an inferred athlete.'}</p>
              </article>
            </div>
          </section>

          <section className="panel qualification-guide">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">How it works</p>
                <h2>Confirmation levels</h2>
              </div>
            </div>
            <div className="stacked-list">
              <article className="info-card">
                <h3>Quota allocated</h3>
                <p>The country has a confirmed place. The athlete can still be selected later.</p>
              </article>
              <article className="info-card">
                <h3>Athlete selected or entered</h3>
                <p>The athlete or team has an official named confirmation. Final entry is the strongest state.</p>
              </article>
              <article className="info-card">
                <h3>Rankings are not entries</h3>
                <p>Games28 does not turn rankings, projections, or news reports into qualification cards.</p>
              </article>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Recent changes</p>
                <h2>What moved for {dashboard.country.name}</h2>
              </div>
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
                    <SourceLink href={change.sourceUrl} context={{ changeId: change.id, noc: dashboard.country.noc }} />
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                title="No tracked changes yet"
                description="The first refresh that changes this country’s schedule or confirmed qualification records will appear here."
              />
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
function ChangesView({ runtime, changes }) {
  return (
    <section className="page-section changes-page">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">Change feed</p>
          <h1>Recent schedule and qualification changes</h1>
        </div>
        <span className="supporting-copy">{formatCount(changes.length)} tracked changes</span>
      </div>
      <TrustLine runtime={runtime} className="trust-line--section" />
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
                <SourceLink href={change.sourceUrl} context={{ changeId: change.id }} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No changes recorded yet"
          description="Once the updater sees a real delta in the schedule or confirmed qualification records, this feed will populate."
        />
      )}
    </section>
  );
}

function NotFoundView() {
  return (
    <section className="page-section">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">404</p>
          <h1>That route is not wired yet</h1>
        </div>
      </div>
      <EmptyState
        title="Try the main routes"
        description="Open the home page, sports directory, schedule explorer, change feed, or a country dashboard from the directory."
      />
    </section>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [runtime, setRuntime] = useState(runtimeFallback);
  const [isLoadingRuntime, setIsLoadingRuntime] = useState(true);
  const [showSupportCta, setShowSupportCta] = useState(false);
  const [scheduleFilters, setScheduleFilters] = useStoredState('games28-schedule-filters', DEFAULT_SCHEDULE_FILTERS);
  const [favoriteCountries, setFavoriteCountries] = useStoredState('games28-favorite-countries', []);
  const [countryFiltersState, setCountryFiltersState] = useStoredState('games28-country-filters', DEFAULT_COUNTRY_FILTERS);
  const themePreference = useThemePreference();

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [route.name, route.noc, route.sportSlug, route.sessionId]);

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
  const sports = useMemo(() => buildSportDirectory(runtime), [runtime]);

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

  const currentSport = useMemo(() => {
    if (route.name !== 'sport') {
      return null;
    }
    return findSportBySlug(runtime.scheduleEntries || [], route.sportSlug);
  }, [runtime.scheduleEntries, route]);

  const currentSportEntries = useMemo(() => {
    if (!currentSport) {
      return [];
    }

    return filterScheduleEntries(runtime.scheduleEntries || [], {
      ...scheduleFilters,
      sport: currentSport
    });
  }, [runtime.scheduleEntries, scheduleFilters, currentSport]);

  const currentSession = useMemo(() => {
    if (route.name !== 'session') {
      return null;
    }
    return (runtime.scheduleEntries || []).find((entry) => entry.id === route.sessionId) || null;
  }, [runtime.scheduleEntries, route]);

  const changes = useMemo(() => {
    return [...(runtime.changes || [])].sort((left, right) => String(right.changedAt).localeCompare(String(left.changedAt)));
  }, [runtime.changes]);

  function toggleFavoriteCountry(noc) {
    setFavoriteCountries((current) => {
      const next = current.includes(noc) ? current.filter((entry) => entry !== noc) : [...current, noc].sort();
      trackEvent('country_save', { noc, saved: next.includes(noc) });
      return next;
    });
  }

  function handleCalendarExport(entries, title, eventName, eventData = {}) {
    const exported = downloadCalendarEntries(entries, title);
    if (exported) {
      trackEvent(eventName, eventData);
      setShowSupportCta(true);
    }
    return exported;
  }

  return (
    <div className="app-shell">
      <div className="backdrop backdrop-top" />
      <div className="backdrop backdrop-bottom" />
      <header className="site-header">
        <AppLink href="/" className="site-brand">
          <span className="site-brand-mark">G28</span>
          <span>
            <strong>Games28</strong>
            <small>LA 2028 schedule and country dashboards</small>
          </span>
        </AppLink>
        <div className="site-header-actions">
          <SiteNavigation routeName={route.name} />
          <ThemeToggle
            theme={themePreference.theme}
            preference={themePreference.preference}
            onToggle={themePreference.toggleTheme}
            onFollowDevice={themePreference.followDeviceTheme}
          />
        </div>
        <ThemeToggle
          theme={themePreference.theme}
          preference={themePreference.preference}
          onToggle={themePreference.toggleTheme}
          onFollowDevice={themePreference.followDeviceTheme}
          compact
        />
      </header>

      <main className="page-shell">
        <div className="page-content">
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
            onCalendarExport={handleCalendarExport}
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

        {!isLoadingRuntime && route.name === 'countries' ? (
          <CountriesView
            runtime={runtime}
            countryFilters={countryFilters}
            onCountryFiltersChange={setCountryFiltersState}
            countries={countries}
            favorites={favoriteCountries}
            onToggleFavorite={toggleFavoriteCountry}
          />
        ) : null}

        {!isLoadingRuntime && route.name === 'schedule' ? (
          <ScheduleView
            runtime={runtime}
            scheduleEntries={scheduleEntries}
            scheduleFilters={scheduleFilters}
            onScheduleFiltersChange={setScheduleFilters}
            scheduleOptions={scheduleOptions}
            onCalendarExport={handleCalendarExport}
          />
        ) : null}

        {!isLoadingRuntime && route.name === 'sports' ? <SportsView sports={sports} /> : null}

        {!isLoadingRuntime && route.name === 'sport' ? (
          <SportView
            runtime={runtime}
            sport={currentSport}
            entries={currentSportEntries}
            scheduleFilters={scheduleFilters}
            onScheduleFiltersChange={setScheduleFilters}
            scheduleOptions={scheduleOptions}
            onCalendarExport={handleCalendarExport}
          />
        ) : null}

        {!isLoadingRuntime && route.name === 'session' ? (
          <SessionView
            runtime={runtime}
            entry={currentSession}
            onCalendarExport={handleCalendarExport}
          />
        ) : null}

        {!isLoadingRuntime && route.name === 'country' && currentDashboard ? (
          <CountryView
            runtime={runtime}
            dashboard={currentDashboard}
            favoriteCountries={favoriteCountries}
            onToggleFavorite={toggleFavoriteCountry}
            onCalendarExport={handleCalendarExport}
          />
        ) : null}

        {!isLoadingRuntime && route.name === 'changes' ? <ChangesView runtime={runtime} changes={changes} /> : null}
        {!isLoadingRuntime && route.name === 'sources' ? <SourcesView runtime={runtime} /> : null}
        {!isLoadingRuntime && route.name === 'report' ? <ReportUpdateForm countries={runtime.countries} scheduleEntries={runtime.scheduleEntries} /> : null}
        {!isLoadingRuntime && route.name === 'admin' ? <AdminReviewConsole countries={runtime.countries} qualificationSources={runtime.meta.qualificationSources} qualificationCards={runtime.athleteCards} /> : null}
        {!isLoadingRuntime && route.name === 'not-found' ? <NotFoundView /> : null}
        {!isLoadingRuntime && route.name !== 'admin' && showSupportCta ? <SupportCta onDismiss={() => setShowSupportCta(false)} /> : null}
        {!isLoadingRuntime && route.name !== 'admin' ? (
          <SiteFooter
            theme={themePreference.theme}
            themePreference={themePreference.preference}
            onToggleTheme={themePreference.toggleTheme}
            onFollowDeviceTheme={themePreference.followDeviceTheme}
          />
        ) : null}
        </div>
      </main>
      <SiteNavigation routeName={route.name} mobile />
    </div>
  );
}
