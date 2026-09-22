import AppLink from './AppLink.jsx';
import SportIcon from './SportIcon.jsx';
import { ShareButton, SourceLink } from './ContentLinks.jsx';
import { getExportableEntries } from '../lib/ics.js';
import { formatDateTimeLabel, formatLaReference, formatScheduleDate, formatStatusLabel } from '../lib/format.js';
import { getSessionPath, getSportPath } from '../lib/seo.js';
import { isMedalEvent } from '../lib/schedule-events.js';

export default function ScheduleCard({ entry, countryMode = false, onCalendarExport }) {
  const medalEvent = isMedalEvent(entry);

  return (
    <article className={`schedule-card ${countryMode ? 'schedule-card--country' : ''}`.trim()}>
      <div className="schedule-card-top">
        <div>
          <p className="eyebrow">
            <AppLink href={getSportPath(entry.sport)} className="eyebrow-link sport-label"><SportIcon sport={entry.sport} size={18} />{entry.sport}</AppLink>
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
          <strong>{entry.startAtUtc ? formatDateTimeLabel(entry.startAtUtc) : 'Time not announced'}</strong>
        </div>
        <div>
          <span className="time-label">LA reference</span>
          <strong>{entry.startAtUtc ? formatLaReference(entry.startAtUtc) : 'Time not announced'}</strong>
        </div>
      </div>
      <div className="schedule-card-details">
        <span>{entry.sessionCode || 'Session TBD'}</span>
        <span>{formatScheduleDate(entry)}</span>
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
            disabled={!getExportableEntries([entry]).length}
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
