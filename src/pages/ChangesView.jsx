import AppLink from '../components/AppLink.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { SourceLink, TrustLine } from '../components/ContentLinks.jsx';
import { formatCount, formatUpdatedLabel } from '../lib/format.js';
import { formatChangeEntityLabel } from '../lib/change-label.js';

export default function ChangesView({ runtime, changes }) {
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
