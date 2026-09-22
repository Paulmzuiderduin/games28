import { useMemo } from 'react';
import AppLink from '../components/AppLink.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ScheduleCard from '../components/ScheduleCard.jsx';
import { ShareButton, TrustLine } from '../components/ContentLinks.jsx';
import { OfficialQualificationRules, SportQualificationOverview } from '../components/QualificationViews.jsx';
import SportIcon from '../components/SportIcon.jsx';
import { getExportableEntries } from '../lib/ics.js';
import { formatCount, getViewerTimeZoneLabel } from '../lib/format.js';
import { getSportPath } from '../lib/seo.js';
import { buildSportQualificationOverview } from '../lib/view-models.js';

export default function SportView({ runtime, sport, entries, scheduleFilters, onScheduleFiltersChange, scheduleOptions, onCalendarExport }) {
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
          <h1 className="sport-label"><SportIcon sport={sport} size={36} /><span>{sport}</span></h1>
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
            disabled={!getExportableEntries(entries).length}
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
      <OfficialQualificationRules runtime={runtime} sport={sport} />
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
            <span>Date (your timezone)</span>
            <select value={scheduleFilters.dayKey} onChange={(event) => onScheduleFiltersChange({ ...scheduleFilters, dayKey: event.target.value })}>
              <option value="all">All competition days</option>
              {scheduleOptions.dayOptions.map((dayKey) => (
                <option key={dayKey} value={dayKey}>
                  {dayKey === 'time-tbd' ? 'Time not announced' : dayKey}
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
