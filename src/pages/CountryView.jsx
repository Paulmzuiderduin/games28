import { useMemo } from 'react';
import AppLink from '../components/AppLink.jsx';
import CountryFlag from '../components/CountryFlag.jsx';
import SportIcon from '../components/SportIcon.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ScheduleCard from '../components/ScheduleCard.jsx';
import SummaryCard from '../components/SummaryCard.jsx';
import { ShareButton, SourceLink, TrustLine } from '../components/ContentLinks.jsx';
import { QuotaLinkDetails } from '../components/QualificationViews.jsx';
import { getExportableEntries } from '../lib/ics.js';
import { formatCount, formatStatusLabel, formatUpdatedLabel } from '../lib/format.js';
import { formatChangeEntityLabel } from '../lib/change-label.js';
import { getSportPath } from '../lib/seo.js';
import { buildCountryQualificationOverview, buildCountryScheduleStatusOverview } from '../lib/view-models.js';

function compactQuotaDescription(card) {
  const count = Number.isInteger(card.quotaCount) && card.quotaCount > 0 ? card.quotaCount : 1;
  const unit = card.subjectType === 'team_quota' ? 'team quota' : 'quota place';
  const countLabel = `${count} ${unit}${count === 1 ? '' : 's'}`;
  return card.qualificationRoute ? `${countLabel} · ${card.qualificationRoute}` : countLabel;
}

function compactQuotaSelection(card) {
  if (card.allocationLinkProblem || card.quotaLinkProblem) return 'Selection link awaiting review';
  if (card.quotaOccupants?.length) return `Selected: ${card.quotaOccupants.map((entry) => entry.name).join(', ')}`;
  return card.subjectType === 'team_quota' ? 'Final team not selected yet' : 'Athlete not selected yet';
}

export default function CountryView({ runtime, dashboard, favoriteCountries, onToggleFavorite, onCalendarExport }) {
  const hasQualificationData = dashboard.athleteCards.length > 0;
  const hasConfirmedSessions = dashboard.confirmedSessions.length > 0;
  const qualificationOverview = useMemo(
    () => buildCountryQualificationOverview(runtime, dashboard.quotaPlaces),
    [runtime, dashboard.quotaPlaces]
  );
  const qualificationSportCount = useMemo(
    () => new Set(dashboard.athleteCards.map((card) => card.sport).filter(Boolean)).size,
    [dashboard.athleteCards]
  );
  const scheduleStatusOverview = useMemo(
    () => buildCountryScheduleStatusOverview(dashboard.awaitingScheduleGroups),
    [dashboard.awaitingScheduleGroups]
  );

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
              disabled={!getExportableEntries(dashboard.confirmedSessions).length}
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
          Confirmed quotas, official selections, and final entries only — never ranking-based predictions.
        </p>
        <div className="country-page__meta">
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
      </div>

      <section className="summary-grid country-page__stats">
        <SummaryCard label="Confirmed athletes / teams" value={dashboard.stats.namedAthleteCount} />
        <SummaryCard label="Confirmed quota places" value={dashboard.stats.quotaCount} detail="Places and team slots; not an athlete total." />
        <SummaryCard label="Confirmed sessions" value={dashboard.stats.confirmedSessionCount} />
        <SummaryCard label="Entries awaiting draw" value={dashboard.stats.awaitingScheduleGroupCount} />
      </section>

      <section className="country-section country-section--qualification">
        <div className="country-section__heading">
          <div className="country-section__title">
            <span className="country-section__marker" aria-hidden="true" />
            <div>
              <p className="eyebrow">Qualification</p>
              <h2>What {dashboard.country.name} has qualified for</h2>
            </div>
          </div>
          {hasQualificationData ? (
            <div className="country-section__summary" aria-label="Qualification totals">
              <strong>{formatCount(dashboard.stats.quotaCount || dashboard.stats.namedAthleteCount)}</strong>
              <span>
                {dashboard.stats.quotaCount
                  ? `quota ${dashboard.stats.quotaCount === 1 ? 'place' : 'places'}`
                  : `named ${dashboard.stats.namedAthleteCount === 1 ? 'entry' : 'entries'}`}
                {' · '}{formatCount(qualificationSportCount)} {qualificationSportCount === 1 ? 'sport' : 'sports'}
              </span>
            </div>
          ) : null}
        </div>

        {dashboard.namedAthletes.length ? (
          <div className="country-qualification-block">
            <div className="country-subsection-heading">
              <h3>Named athletes and teams</h3>
              <span>{formatCount(dashboard.namedAthletes.length)} confirmed</span>
            </div>
            <div className="country-named-list">
              {dashboard.namedAthletes.map((card) => (
                <article key={card.id} className="country-named-row">
                  <SportIcon sport={card.sport} size={24} />
                  <div className="country-named-row__identity">
                    <strong>{card.name}</strong>
                    <span>{card.sport} · {(card.disciplines || []).join(', ') || 'Event not specified'}</span>
                    <QuotaLinkDetails card={card} />
                  </div>
                  <div className="country-named-row__meta">
                    <span className="tag confirmed">{formatStatusLabel(card.state || card.status)}</span>
                    {card.profileUrl ? <SourceLink href={card.profileUrl} context={{ noc: card.noc, athleteId: card.id }}>Profile</SourceLink> : null}
                    {card.sourceUrl ? <SourceLink href={card.sourceUrl} context={{ noc: card.noc, athleteId: card.id }} /> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {qualificationOverview.groups.length ? (
          <div className="country-qualification-block">
            <div className="country-subsection-heading">
              <h3>Quota overview by sport</h3>
              <span>{formatCount(qualificationOverview.stats.eventCount)} qualified events</span>
            </div>
            <div className="country-quota-grid">
              {qualificationOverview.groups.map((group) => (
                <article key={group.id} className="country-quota-sport">
                  <div className="country-quota-sport__heading">
                    <div>
                      <SportIcon sport={group.sport} size={25} />
                      <h3>{group.sport}</h3>
                    </div>
                    <span>{formatCount(group.cards.length)} {group.cards.length === 1 ? 'event' : 'events'}</span>
                  </div>
                  <ul className="country-quota-events">
                    {group.cards.map((card) => (
                      <li key={card.id}>
                        <div className="country-quota-event__copy">
                          <strong>{card.eventLabel}</strong>
                          <span>{compactQuotaDescription(card)}</span>
                          <small>{compactQuotaSelection(card)}</small>
                        </div>
                        {card.sourceUrl ? <SourceLink href={card.sourceUrl} context={{ noc: card.noc, athleteId: card.id }} /> : null}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {!hasQualificationData ? (
          <EmptyState
            compact
            title="No confirmed qualification records yet"
            description="A quota, athlete, or team appears only after an official federation, NOC, or IOC source confirms it."
          />
        ) : null}
      </section>

      <div className="country-page__body">
        <div className="country-page__main">
          <section className="country-section country-section--schedule">
            <div className="country-section__heading">
              <div className="country-section__title">
                <span className="country-section__marker" aria-hidden="true" />
                <div>
                  <p className="eyebrow">Country schedule</p>
                  <h2>Confirmed sessions</h2>
                </div>
              </div>
              <span className="status-pill">Exact entries only</span>
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
        </div>

        <aside className="country-page__aside">
          <section className="country-section country-section--status">
            <div className="country-section__heading">
              <div className="country-section__title">
                <span className="country-section__marker" aria-hidden="true" />
                <div>
                  <p className="eyebrow">Schedule status</p>
                  <h2>Qualified, session unknown</h2>
                </div>
              </div>
            </div>
            {scheduleStatusOverview.length ? (
              <div className="country-status-list">
                {scheduleStatusOverview.map((group) => (
                  <article key={group.id} className="country-status-row">
                    <SportIcon sport={group.sport} size={23} />
                    <div className="country-status-row__copy">
                      <div className="country-status-row__heading">
                        <div>
                          <h3>{group.sport}</h3>
                          <p>{group.disciplines.join(' · ') || 'Qualified entry'}</p>
                        </div>
                        <span className="tag pending">Awaiting draw</span>
                      </div>
                      <p className="awaiting-entry-note">
                        {group.entryCount} qualified {group.entryCount === 1 ? 'entry' : 'entries'} in this sport; exact sessions appear after the official draw or entry list.
                      </p>
                      <div className="country-status-row__actions">
                        <AppLink href={getSportPath(group.sport)} className="text-link">Open {group.sport} schedule</AppLink>
                        {group.sourceUrls.map((sourceUrl, index) => (
                          <SourceLink key={sourceUrl} href={sourceUrl} context={{ noc: dashboard.country.noc, sport: group.sport }}>
                            {group.sourceUrls.length > 1 ? `Source ${index + 1}` : 'Source'}
                          </SourceLink>
                        ))}
                      </div>
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
