import AppLink from '../components/AppLink.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SummaryCard from '../components/SummaryCard.jsx';
import { ShareButton, SourceLink, TrustLine } from '../components/ContentLinks.jsx';
import { getExportableEntries } from '../lib/ics.js';
import { formatDateTimeLabel, formatLaReference, formatScheduleDate } from '../lib/format.js';
import { getSessionPath, getSportPath } from '../lib/seo.js';

export default function SessionView({ runtime, entry, onCalendarExport }) {
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
            disabled={!getExportableEntries([entry]).length}
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
            <strong>{entry.startAtUtc ? formatDateTimeLabel(entry.startAtUtc) : 'Time not announced'}</strong>
          </div>
          <div>
            <span className="time-label">LA reference</span>
            <strong>{entry.startAtUtc ? formatLaReference(entry.startAtUtc) : 'Time not announced'}</strong>
          </div>
        </div>
        <div className="session-facts">
          <SummaryCard label="Venue" value={entry.venue || 'Venue TBC'} />
          <SummaryCard label="Date" value={formatScheduleDate(entry)} />
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
