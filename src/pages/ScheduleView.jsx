import AppLink from '../components/AppLink.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { TrustLine } from '../components/ContentLinks.jsx';
import FilterBar from '../components/FilterBar.jsx';
import ScheduleCard from '../components/ScheduleCard.jsx';
import { getExportableEntries } from '../lib/ics.js';

export default function ScheduleView({ runtime, scheduleEntries, scheduleFilters, onScheduleFiltersChange, scheduleOptions, onCalendarExport }) {
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
            disabled={!getExportableEntries(scheduleEntries).length}
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
