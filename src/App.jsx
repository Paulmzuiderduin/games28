import { applySeoPage, getSeoPage } from './lib/seo-pages.js';
import { useEffect, useMemo, useState } from 'react';
import AppLink from './components/AppLink.jsx';
import { SiteNavigation, SiteFooter, SupportCta, ThemeToggle } from './components/AppChrome.jsx';
import EmptyState from './components/EmptyState.jsx';
import AdminReviewConsole from './components/AdminReviewConsole.jsx';
import ReportUpdateForm from './components/ReportUpdateForm.jsx';
import SportsView from './pages/SportsView.jsx';
import HomeView from './pages/HomeView.jsx';
import CountriesView from './pages/CountriesView.jsx';
import ScheduleView from './pages/ScheduleView.jsx';
import SessionView from './pages/SessionView.jsx';
import SourcesView from './pages/SourcesView.jsx';
import ChangesView from './pages/ChangesView.jsx';
import NotFoundView from './pages/NotFoundView.jsx';
import CountryView from './pages/CountryView.jsx';

import SportView from './pages/SportView.jsx';
import { downloadCalendarEntries, getExportableEntries } from './lib/ics.js';
import { trackEvent } from './lib/analytics.js';
import { parseRoute } from './lib/router.js';
import { loadRuntimeDataset, runtimeFallback } from './lib/runtime-data.js';
import { findSportBySlug } from './lib/seo.js';
import {
  buildCountryDashboard,
  buildHomeStats,
  buildScheduleOptions,
  buildSportDirectory,
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

const THEME_PREFERENCE_KEY = 'games28-theme-preference';


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

export default function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [runtime, setRuntime] = useState(runtimeFallback);
  const [isLoadingRuntime, setIsLoadingRuntime] = useState(true);
  const [runtimeLoadError, setRuntimeLoadError] = useState('');
  const [runtimeReloadKey, setRuntimeReloadKey] = useState(0);
  const [showSupportCta, setShowSupportCta] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
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
      setRuntimeLoadError('');
      try {
        const dataset = await loadRuntimeDataset();
        if (!cancelled) setRuntime(dataset);
      } catch (error) {
        console.error('Unable to load the Games28 runtime dataset.', error);
        if (!cancelled) setRuntimeLoadError('The latest Games28 data could not be loaded. Your connection may be offline, or the data service may be temporarily unavailable.');
      } finally {
        if (!cancelled) setIsLoadingRuntime(false);
      }
    }

    hydrateRuntime();
    return () => {
      cancelled = true;
    };
  }, [runtimeReloadKey]);

  useEffect(() => {
    if (!isLoadingRuntime) applySeoPage(getSeoPage(runtime, window.location.pathname));
  }, [runtime, isLoadingRuntime, route]);

  const scheduleEntries = useMemo(() => {
    return filterScheduleEntries(runtime.scheduleEntries || [], scheduleFilters);
  }, [runtime.scheduleEntries, scheduleFilters]);

  const scheduleOptions = useMemo(() => buildScheduleOptions(runtime.scheduleEntries || []), [runtime.scheduleEntries]);
  const homeStats = useMemo(() => buildHomeStats(runtime), [runtime]);
  const sports = useMemo(() => buildSportDirectory(runtime), [runtime]);

  const countryFilters = useMemo(() => ({
    ...countryFiltersState,
    favorites: favoriteCountries
  }), [countryFiltersState, favoriteCountries]);

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
    return (runtime.scheduleEntries || []).find((entry) => entry.id === route.sessionId || entry.aliasIds?.includes(route.sessionId)) || null;
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
    const valid = getExportableEntries(entries);
    const skipped = entries.length - valid.length;
    const exported = downloadCalendarEntries(valid, title);
    setExportNotice(exported ? `Exported ${valid.length} schedule entries.${skipped ? ` Skipped ${skipped} entries with unavailable or invalid times.` : ''}` : 'No entries with confirmed times are available to export.');
    if (exported) {
      trackEvent(eventName, { ...eventData, count: valid.length, skipped });
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
        {exportNotice ? <p className="timezone-note" role="status">{exportNotice}</p> : null}
        {isLoadingRuntime ? (
          <section className="panel page-section">
            <EmptyState
              title="Loading the latest Games28 snapshot"
              description="The app is fetching the generated runtime dataset."
            />
          </section>
        ) : null}

        {!isLoadingRuntime && runtimeLoadError ? (
          <section className="panel page-section" role="alert">
            <EmptyState
              title="Games28 data is temporarily unavailable"
              description={runtimeLoadError}
            >
              <button type="button" className="button-primary" onClick={() => setRuntimeReloadKey((current) => current + 1)}>
                Try loading again
              </button>
            </EmptyState>
          </section>
        ) : null}

        {!isLoadingRuntime && !runtimeLoadError && route.name === 'home' ? (
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

        {!isLoadingRuntime && !runtimeLoadError && route.name === 'countries' ? (
          <CountriesView
            runtime={runtime}
            countryFilters={countryFilters}
            onCountryFiltersChange={setCountryFiltersState}
            countries={countries}
            favorites={favoriteCountries}
            onToggleFavorite={toggleFavoriteCountry}
          />
        ) : null}

        {!isLoadingRuntime && !runtimeLoadError && route.name === 'schedule' ? (
          <ScheduleView
            runtime={runtime}
            scheduleEntries={scheduleEntries}
            scheduleFilters={scheduleFilters}
            onScheduleFiltersChange={setScheduleFilters}
            scheduleOptions={scheduleOptions}
            onCalendarExport={handleCalendarExport}
          />
        ) : null}

        {!isLoadingRuntime && !runtimeLoadError && route.name === 'sports' ? <SportsView sports={sports} /> : null}

        {!isLoadingRuntime && !runtimeLoadError && route.name === 'sport' ? (
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

        {!isLoadingRuntime && !runtimeLoadError && route.name === 'session' ? (
          <SessionView
            runtime={runtime}
            entry={currentSession}
            onCalendarExport={handleCalendarExport}
          />
        ) : null}

        {!isLoadingRuntime && !runtimeLoadError && route.name === 'country' && currentDashboard ? (
          <CountryView
            runtime={runtime}
            dashboard={currentDashboard}
            favoriteCountries={favoriteCountries}
            onToggleFavorite={toggleFavoriteCountry}
            onCalendarExport={handleCalendarExport}
          />
        ) : null}

        {!isLoadingRuntime && !runtimeLoadError && route.name === 'changes' ? <ChangesView runtime={runtime} changes={changes} /> : null}
        {!isLoadingRuntime && !runtimeLoadError && route.name === 'sources' ? <SourcesView runtime={runtime} /> : null}
        {!isLoadingRuntime && !runtimeLoadError && route.name === 'report' ? <ReportUpdateForm countries={runtime.countries} scheduleEntries={runtime.scheduleEntries} /> : null}
        {!isLoadingRuntime && !runtimeLoadError && route.name === 'admin' ? <AdminReviewConsole countries={runtime.countries} qualificationSources={runtime.meta.qualificationSources} qualificationCards={runtime.athleteCards} /> : null}
        {!isLoadingRuntime && !runtimeLoadError && route.name === 'not-found' ? <NotFoundView /> : null}
        {!isLoadingRuntime && !runtimeLoadError && route.name !== 'admin' && showSupportCta ? <SupportCta onDismiss={() => setShowSupportCta(false)} /> : null}
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
