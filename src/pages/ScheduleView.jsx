import { useEffect, useState } from 'react';
import AppLink from '../components/AppLink.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { TrustLine } from '../components/ContentLinks.jsx';
import FilterBar from '../components/FilterBar.jsx';
import ScheduleCard from '../components/ScheduleCard.jsx';
import { getExportableEntries } from '../lib/ics.js';
import { countUniqueSessions } from '../lib/schedule-events.js';

const PAGE_SIZE = 96;

export default function ScheduleView({
  runtime,
  scheduleEntries,
  scheduleFilters,
  onScheduleFiltersChange,
  scheduleOptions,
  onCalendarExport
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [scheduleFilters.sport, scheduleFilters.dayKey, scheduleFilters.searchText]);

  const visibleEntries = scheduleEntries.slice(0, visibleCount);
  const hasHiddenEntries = visibleEntries.length < scheduleEntries.length;
  const sessionCount = countUniqueSessions(scheduleEntries);

  return (
    <section className="page-section">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1>Competition schedule</h1>
        </div>
        <div className="heading-meta">
          <span className="status-pill">
            {sessionCount} session{sessionCount === 1 ? '' : 's'} · {scheduleEntries.length} event
            {scheduleEntries.length === 1 ? '' : 's'}
          </span>
          <AppLink href="/sports" className="text-link">
            Browse sports
          </AppLink>
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              onCalendarExport(scheduleEntries, 'games28-visible-schedule', 'calendar_export_visible', {
                route: 'schedule',
                count: scheduleEntries.length
              })
            }
            disabled={!getExportableEntries(scheduleEntries).length}
          >
            Export filtered schedule
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
        <>
          <div className="schedule-grid">
            {visibleEntries.map((entry) => (
              <ScheduleCard key={entry.id} entry={entry} onCalendarExport={onCalendarExport} />
            ))}
          </div>
          {hasHiddenEntries ? (
            <div className="section-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, scheduleEntries.length - visibleEntries.length)} more
              </button>
              <p className="supporting-copy">
                Showing {visibleEntries.length} of {scheduleEntries.length} schedule entries.
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState title="No schedule results" description="No sessions match those filters yet." />
      )}
    </section>
  );
}
