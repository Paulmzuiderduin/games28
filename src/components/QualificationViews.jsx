import AppLink from './AppLink.jsx';
import CountryFlag from './CountryFlag.jsx';
import EmptyState from './EmptyState.jsx';
import { SourceLink } from './ContentLinks.jsx';
import { formatCount, formatDateLabel, formatUpdatedLabel } from '../lib/format.js';
import { getSportGroup } from '../lib/sport-groups.js';

export function QuotaLinkDetails({ card }) {
  if (card.allocationLinkProblem || card.quotaLinkProblem) return <p className="supporting-copy">Quota link awaiting review. The official qualification record is preserved.</p>;
  if (card.quotaOccupants) return <div className="supporting-copy">
    <p>{card.filledQuotaCount} of {card.quotaCount} places linked to selections; {card.remainingQuotaCount} not yet linked to a selection.</p>
    {card.quotaOccupants.map(person => <p key={person.id}>{person.name}{person.sourceUrl ? <> · <SourceLink href={person.sourceUrl}>Selection source</SourceLink></> : null}</p>)}
  </div>;
  if (card.allocationRecordId) return <p className="supporting-copy">Fills an existing country quota, not an additional place.</p>;
  return null;
}

export function SportQualificationOverview({ overview, sport }) {
  return (
    <section className="sport-qualification-section">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">Qualification</p>
          <h2>Confirmed qualification</h2>
          <p className="supporting-copy">Official quota places and named athletes or teams, grouped by event. No rankings or predictions.</p>
        </div>
        {overview.cards.length ? <span className="status-pill">{formatCount(overview.stats.countryCount)} {overview.stats.countryCount === 1 ? 'country' : 'countries'}</span> : null}
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
                      <QuotaLinkDetails card={card} />
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

export function OfficialQualificationRules({ runtime, sport }) {
  const source = (runtime.meta?.qualificationSources || []).find((entry) => (
    entry.qualificationSystemKey && (entry.sports || []).map(getSportGroup).includes(sport)
  ));
  const checksById = new Map((runtime.meta?.iocQualificationRules?.documents || []).map((entry) => [entry.id, entry]));
  const documents = (source?.iocDocuments || [])
    .filter((entry) => !(entry.sports || []).length || entry.sports.map(getSportGroup).includes(sport))
    .map((entry) => ({ ...entry, ...checksById.get(entry.id) }));

  if (!source) return null;

  return (
    <section className="sport-rules-section">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">Qualification rules</p>
          <h2>How qualification works</h2>
          <p className="supporting-copy">These IOC-published documents explain the official quota and qualification pathway. They do not confirm that a country, athlete, or team has qualified.</p>
        </div>
        <span className="status-pill">IOC rules</span>
      </div>
      {documents.length ? (
        <div className="official-rules-list">
          {documents.map((document) => (
            <article key={document.id} className="official-rule-row">
              <div>
                <strong>{document.title}</strong>
                <span>Published {formatDateLabel(document.publishedAt, { includeWeekday: false, timeZone: 'UTC' })}</span>
              </div>
              <SourceLink
                href={document.url}
                className="text-link"
                context={{ sourceId: source.id, qualificationSystemKey: source.qualificationSystemKey, documentId: document.id }}
              >
                Open IOC document
              </SourceLink>
            </article>
          ))}
        </div>
      ) : (
        <p className="official-rules-empty">The IOC has not published a sport-specific LA28 qualification PDF here yet. Games28 is still watching the official {source.governingBody} source for confirmed allocations and selections.</p>
      )}
    </section>
  );
}

export function qualificationDetail(card) {
  const discipline = (card.disciplines || []).join(', ');
  if (card.subjectType !== 'team_quota') return discipline;
  const capacity = card.teamSizeMax ? `Up to ${card.teamSizeMax} ${card.sport === 'Equestrian' ? 'athlete-and-horse combinations' : 'athletes'} per team` : '';
  return [discipline, capacity].filter(Boolean).join(' · ');
}

export function sportQualificationStatus(card) {
  const state = String(card.state || '').toLowerCase();
  if (state === 'entered') return 'Final entry confirmed';
  if (state === 'selected') return card.teamType === 'team' ? 'Team selected' : 'Athlete selected';
  if (card.status === 'named') return card.teamType === 'team' ? 'Named team' : 'Named athlete';
  if (state === 'earned') return 'Qualification earned';
  return 'Quota allocated';
}

export function isNamedQualification(card) {
  return card.status === 'named' || ['selected', 'entered'].includes(card.state);
}
