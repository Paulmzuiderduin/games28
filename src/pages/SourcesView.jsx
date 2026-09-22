import { officialCheckStatus } from '../lib/source-status.js';
import { formatUpdatedLabel } from '../lib/format.js';
import SummaryCard from '../components/SummaryCard.jsx';
import { SourceLink } from '../components/ContentLinks.jsx';

export default function SourcesView({ runtime }) {
  const authorityLabel = runtime.meta.scheduleAuthority === 'official_pdf'
    ? 'Official PDF is live'
    : runtime.meta.scheduleAuthority === 'stale_official'
      ? 'Last good official schedule'
      : 'Community fallback is live';
  const officialCheck = officialCheckStatus(runtime.meta);
  const qualificationCoverage = runtime.meta.qualificationCoverage || {};
  const countrySelectionCoverage = runtime.meta.countrySelectionCoverage || {};
  const iocQualificationRules = runtime.meta.iocQualificationRules || {};
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
          value={officialCheck.value}
          detail={officialCheck.detail}
        />
        <SummaryCard
          label="Qualification systems"
          value={`${qualificationCoverage.coveredSportCount || 0} schedule labels covered`}
          detail={`${qualificationCoverage.systemCount || 0} official sport groups are checked daily. No predictions are published.`}
        />
        <SummaryCard
          label="IOC qualification rules"
          value={`${iocQualificationRules.publishedSystemCount || 0}/${iocQualificationRules.expectedSystemCount || qualificationCoverage.systemCount || 0} published`}
          detail={`${iocQualificationRules.listedDocumentCount || 0} direct IOC documents listed; sports without a document stay clearly marked as waiting.`}
        />
        <SummaryCard
          label="Country selection sources"
          value={`${countrySelectionCoverage.configuredCount || 0}/${countrySelectionCoverage.countryCount || runtime.countries.length || 0} configured`}
          detail="Every IOC NOC has a source slot; unavailable endpoints stay explicitly unavailable."
        />
        <SummaryCard
          label="Qualification monitoring"
          value={`${runtime.meta.qualificationSourceScanCount || 0} automated source checks`}
          detail={`${runtime.meta.qualificationReferenceSourceCount || 0} bot-blocked official pages are retained as manual references, not reported as failed checks. ${runtime.meta.qualificationAutoRecordCount
            ? `${runtime.meta.qualificationAutoRecordCount} structured records passed automatic validation.`
            : 'Only complete official allocation tables publish automatically; prose stays in review.'}`}
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
