import { useEffect, useMemo, useState } from 'react';
import {
  getAdminSession,
  getReviewCandidates,
  isSupabaseConfigured,
  requestAdminMagicLink,
  resolveReviewCandidate,
  signOutAdmin
} from '../lib/supabase.js';

const EMPTY_DRAFT = {
  noc: '', sport: '', disciplines: [], subjectType: 'noc_quota', state: 'allocated',
  athleteName: '', teamName: '', quotaCount: '1', qualificationRoute: '', sourcePublishedAt: ''
};

const SUBJECT_LABELS = {
  noc_quota: 'Country quota',
  athlete: 'Named athlete',
  team: 'Named team'
};

const STATE_LABELS = {
  allocated: 'Country or team has qualified',
  earned: 'Athlete or team earned the place',
  selected: 'Official NOC/federation selected them',
  entered: 'Final LA28 entry list confirms them'
};

function localCandidateUrl() {
  const base = import.meta.env.VITE_DATA_BASE_URL || '';
  return `${base.replace(/\/$/, '')}/qualification-ingestion.json` || '/qualification-ingestion.json';
}

function suggestedRecord(candidate) {
  return candidate?.suggested_record || candidate?.suggestedRecord || {};
}

function candidateDraft(candidate, source) {
  const suggested = suggestedRecord(candidate);
  return {
    noc: suggested.noc || '',
    sport: suggested.sport || source?.sport || '',
    disciplines: Array.isArray(suggested.disciplines) ? suggested.disciplines : [],
    subjectType: suggested.subjectType || 'noc_quota',
    state: suggested.state || 'allocated',
    athleteName: suggested.athleteName || '',
    teamName: suggested.teamName || '',
    quotaCount: String(suggested.quotaCount || 1),
    qualificationRoute: suggested.qualificationRoute || '',
    sourcePublishedAt: String(suggested.sourcePublishedAt || candidate?.detected_at || candidate?.detectedAt || '').slice(0, 10)
  };
}

function sourceFor(candidate, qualificationSources) {
  return qualificationSources.find((entry) => entry.id === candidate.source_id || entry.id === candidate.sourceId);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
    : 'Not supplied';
}

function countryName(countries, noc) {
  const country = countries.find((entry) => entry.noc === noc);
  return country ? `${country.name} (${noc})` : noc || 'Not supplied';
}

function suggestedSubject(candidate, countries) {
  const suggested = suggestedRecord(candidate);
  const subject = suggested.subjectType === 'team'
    ? suggested.teamName
    : suggested.subjectType === 'athlete'
      ? suggested.athleteName
      : suggested.quotaCount
        ? `${suggested.quotaCount} ${suggested.quotaCount === 1 ? 'quota place' : 'quota places'}`
        : 'Qualification record';
  return `${countryName(countries, suggested.noc)} · ${subject || 'Qualification record'}`;
}

function getSportOptions(scheduleEntries, qualificationSources) {
  return [...new Set([
    ...scheduleEntries.map((entry) => entry.sport),
    ...qualificationSources.flatMap((source) => source.sports || [source.sport])
  ].filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function getDisciplineOptions(scheduleEntries, sport) {
  if (!sport) return [];

  return [...new Set(
    scheduleEntries
      .filter((entry) => entry.sport === sport)
      .map((entry) => entry.discipline || entry.eventName)
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right));
}

export default function AdminReviewConsole({ countries = [], qualificationSources = [], scheduleEntries = [] }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [note, setNote] = useState('');

  const pendingCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.status === 'pending'),
    [candidates]
  );
  const selectedCandidate = pendingCandidates.find((candidate) => candidate.id === selectedCandidateId) || null;
  const sportOptions = useMemo(
    () => getSportOptions(scheduleEntries, qualificationSources),
    [scheduleEntries, qualificationSources]
  );

  async function loadCandidates() {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        setCandidates(await getReviewCandidates());
      } else {
        const response = await fetch(localCandidateUrl(), { headers: { 'cache-control': 'no-cache' } });
        const artifact = response.ok ? await response.json() : { reviewQueue: [] };
        setCandidates((artifact.reviewQueue || []).map((candidate) => ({
          ...candidate,
          status: candidate.resolution || 'pending',
          detected_at: candidate.detectedAt,
          extracted_evidence: candidate.extractedEvidence,
          source_url: candidate.sourceUrl,
          suggested_record: candidate.suggestedRecord || null
        })));
      }
    } catch (error) {
      setMessage(error.message || 'Unable to load review candidates.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      loadCandidates();
      return;
    }
    getAdminSession().then(setSession).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (session || !isSupabaseConfigured) loadCandidates();
  }, [session]);

  function selectCandidate(candidate) {
    setSelectedCandidateId(candidate.id);
    setDraft(candidateDraft(candidate, sourceFor(candidate, qualificationSources)));
    setNote('');
    setMessage('');
  }

  useEffect(() => {
    if (!selectedCandidate && pendingCandidates[0]) selectCandidate(pendingCandidates[0]);
  }, [pendingCandidates.length, selectedCandidateId]);

  async function requestLink(event) {
    event.preventDefault();
    setIsLoading(true);
    try {
      await requestAdminMagicLink(email);
      setMessage('Check your inbox for the secure sign-in link.');
    } catch (error) {
      setMessage(error.message || 'Unable to request a sign-in link.');
    } finally {
      setIsLoading(false);
    }
  }

  function buildConfirmationRecord(candidate) {
    if (!draft.noc || !draft.sport || !draft.sourcePublishedAt) throw new Error('Confirm the country, sport, and official publication date before approving.');
    if (draft.subjectType === 'athlete' && !draft.athleteName.trim()) throw new Error('Add the athlete name shown in the official source.');
    if (draft.subjectType === 'team' && !draft.teamName.trim()) throw new Error('Add the team name shown in the official source.');
    if (draft.subjectType === 'noc_quota' && (!Number.isInteger(Number(draft.quotaCount)) || Number(draft.quotaCount) < 1)) throw new Error('Quota places must be at least 1.');
    return {
      id: `approved-${candidate.id}`,
      noc: draft.noc,
      sport: draft.sport,
      disciplines: draft.disciplines,
      subjectType: draft.subjectType,
      state: draft.state,
      athleteName: draft.subjectType === 'athlete' ? draft.athleteName.trim() : null,
      teamName: draft.subjectType === 'team' ? draft.teamName.trim() : null,
      quotaCount: draft.subjectType === 'noc_quota' ? Number(draft.quotaCount) : null,
      qualificationRoute: draft.qualificationRoute.trim() || null,
      sourceId: candidate.source_id || candidate.sourceId,
      sourceUrl: candidate.source_url || candidate.sourceUrl,
      sourcePublishedAt: new Date(draft.sourcePublishedAt).toISOString(),
      verifiedAt: new Date().toISOString(),
      sourceRecordType: 'review_approved'
    };
  }

  async function resolve(candidate, status) {
    let confirmationRecord = null;
    try {
      if (status === 'approved') confirmationRecord = buildConfirmationRecord(candidate);
    } catch (error) {
      setMessage(error.message);
      return;
    }
    setIsLoading(true);
    try {
      await resolveReviewCandidate({ id: candidate.id, status, confirmationRecord, resolutionNote: note });
      setMessage(status === 'approved'
        ? 'Approved. Games28 will publish this confirmed record in the next daily refresh.'
        : 'Rejected. This item will not appear on the public site.');
      setSelectedCandidateId(null);
      setDraft(EMPTY_DRAFT);
      setNote('');
      await loadCandidates();
    } catch (error) {
      setMessage(error.message || 'Unable to save this decision.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="panel page-section admin-console">
        <p className="eyebrow">Private review console</p>
        <h1>Review qualification evidence</h1>
        <p>Supabase is not connected yet, so this read-only preview shows daily candidates from the local ingestion artifact. Approval controls unlock after secure owner login is configured.</p>
        {candidates.length ? candidates.map((candidate) => <CandidateEvidence key={candidate.id} candidate={candidate} countries={countries} source={sourceFor(candidate, qualificationSources)} />) : <p className="supporting-copy">No review candidates are waiting right now.</p>}
      </section>
    );
  }

  if (!session) {
    return (
      <section className="panel page-section admin-console">
        <p className="eyebrow">Private review console</p>
        <h1>Sign in to review qualification evidence</h1>
        <p>Only the Games28 owner can access, approve, or reject candidate records.</p>
        <form className="admin-login" onSubmit={requestLink}>
          <label>
            <span>Email address</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" />
          </label>
          <button className="button-primary" type="submit" disabled={isLoading}>Send secure sign-in link</button>
        </form>
        {message ? <p className="supporting-copy">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="panel page-section admin-console">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Private review console</p>
          <h1>Confirm qualification reports</h1>
          <p>{pendingCandidates.length} waiting · {session.user.email}</p>
        </div>
        <button type="button" className="button-secondary" onClick={() => signOutAdmin().then(() => setSession(null))}>Sign out</button>
      </div>
      <section className="admin-how-it-works" aria-label="How to review a qualification report">
        <p><strong>1. Check the official source.</strong> Open the link and verify the finding.</p>
        <p><strong>2. Check the proposed record.</strong> It is pre-filled; edit only what the source clearly proves.</p>
        <p><strong>3. Decide.</strong> Approve for the next daily publish, or reject so it stays private.</p>
      </section>
      {message ? <p className="timezone-note">{message}</p> : null}
      {selectedCandidate ? (
        <div className="admin-review-layout">
          <CandidateEvidence candidate={selectedCandidate} countries={countries} source={sourceFor(selectedCandidate, qualificationSources)} />
          <ReviewEditor
            candidate={selectedCandidate}
            countries={countries}
            sportOptions={sportOptions}
            scheduleEntries={scheduleEntries}
            draft={draft}
            isLoading={isLoading}
            note={note}
            onChange={setDraft}
            onNoteChange={setNote}
            onApprove={() => resolve(selectedCandidate, 'approved')}
            onReject={() => resolve(selectedCandidate, 'rejected')}
          />
        </div>
      ) : !isLoading ? <p className="supporting-copy">No candidates are waiting for a decision.</p> : null}
      {pendingCandidates.length > 1 ? (
        <section className="admin-other-candidates">
          <p className="eyebrow">Other reports</p>
          <h2>Choose the next report to review</h2>
          <div className="admin-candidate-list">
            {pendingCandidates.filter((candidate) => candidate.id !== selectedCandidate?.id).map((candidate) => (
              <button type="button" className="admin-candidate-choice" key={candidate.id} onClick={() => selectCandidate(candidate)}>
                <span>{suggestedSubject(candidate, countries)}</span>
                <small>{sourceFor(candidate, qualificationSources)?.label || 'Official qualification report'}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function CandidateEvidence({ candidate, countries, source }) {
  const suggested = suggestedRecord(candidate);
  const sourceUrl = candidate.source_url || candidate.sourceUrl;
  const evidence = candidate.extracted_evidence || candidate.extractedEvidence;
  return (
    <article className="info-card admin-evidence-card">
      <p className="eyebrow">Step 1 · Official report found</p>
      <h2>{source?.label || 'Official qualification report'}</h2>
      <dl className="admin-evidence-summary">
        <div><dt>What Games28 found</dt><dd>{suggestedSubject(candidate, countries)}</dd></div>
        <div><dt>Sport</dt><dd>{suggested.sport || source?.sport || 'Not supplied'}{suggested.disciplines?.length ? ` · ${suggested.disciplines.join(', ')}` : ''}</dd></div>
        <div><dt>Officially published</dt><dd>{formatDate(suggested.sourcePublishedAt || candidate.detected_at || candidate.detectedAt)}</dd></div>
      </dl>
      <p className="admin-evidence-reason"><strong>Why you are seeing this:</strong> {candidate.reason}</p>
      <a className="button-secondary admin-source-link" href={sourceUrl} target="_blank" rel="noreferrer">Open official source</a>
      <details className="admin-evidence-details">
        <summary>Read the extracted evidence</summary>
        <blockquote>{evidence}</blockquote>
      </details>
    </article>
  );
}

function ReviewEditor({ candidate, countries, sportOptions, scheduleEntries, draft, isLoading, note, onChange, onNoteChange, onApprove, onReject }) {
  const update = (changes) => onChange({ ...draft, ...changes });
  const disciplineOptions = useMemo(
    () => getDisciplineOptions(scheduleEntries, draft.sport),
    [scheduleEntries, draft.sport]
  );
  const currentDiscipline = draft.disciplines.length === 1 ? draft.disciplines[0] : '';
  const hasCurrentSportOption = sportOptions.includes(draft.sport);
  const hasCurrentDisciplineOption = disciplineOptions.includes(currentDiscipline);
  return (
    <section className="admin-review-editor">
      <p className="eyebrow">Step 2 · Check the record</p>
      <h2>What will be published</h2>
      <p className="supporting-copy">These fields are pre-filled from the report. Edit only details the official source makes explicit.</p>
      <label>
        <span>Country</span>
        <select value={draft.noc} onChange={(event) => update({ noc: event.target.value })}>
          <option value="">Choose country</option>
          {countries.map((country) => <option key={country.noc} value={country.noc}>{country.name} ({country.noc})</option>)}
        </select>
      </label>
      <label>
        <span>Sport</span>
        <select value={draft.sport} onChange={(event) => update({ sport: event.target.value, disciplines: [] })}>
          <option value="">Choose sport</option>
          {draft.sport && !hasCurrentSportOption ? <option value={draft.sport}>Current value: {draft.sport}</option> : null}
          {sportOptions.map((sport) => <option key={sport} value={sport}>{sport}</option>)}
        </select>
        <small>Choose the matching LA28 schedule sport. This prevents spelling variations in public records.</small>
      </label>
      <label>
        <span>Event or discipline</span>
        <select value={currentDiscipline} onChange={(event) => update({ disciplines: event.target.value ? [event.target.value] : [] })} disabled={!draft.sport}>
          <option value="">No event specified in the official source</option>
          {currentDiscipline && !hasCurrentDisciplineOption ? <option value={currentDiscipline}>Current value: {currentDiscipline}</option> : null}
          {disciplineOptions.map((discipline) => <option key={discipline} value={discipline}>{discipline}</option>)}
        </select>
        <small>Only choose an event when the official source explicitly names it. Otherwise, leave this as no event specified.</small>
      </label>
      <div className="admin-form-row">
        <label>
          <span>This record represents</span>
          <select value={draft.subjectType} onChange={(event) => update({ subjectType: event.target.value })}>
            <option value="noc_quota">Country quota</option>
            <option value="athlete">Named athlete</option>
            <option value="team">Named team</option>
          </select>
          <small>{SUBJECT_LABELS[draft.subjectType]}</small>
        </label>
        <label>
          <span>Qualification outcome</span>
          <select value={draft.state} onChange={(event) => update({ state: event.target.value })}>
            {Object.entries(STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <small>{STATE_LABELS[draft.state]}</small>
        </label>
      </div>
      {draft.subjectType === 'noc_quota' ? <label><span>Confirmed quota places</span><input type="number" min="1" value={draft.quotaCount} onChange={(event) => update({ quotaCount: event.target.value })} /></label> : null}
      {draft.subjectType === 'athlete' ? <label><span>Confirmed athlete name</span><input value={draft.athleteName} onChange={(event) => update({ athleteName: event.target.value })} /></label> : null}
      {draft.subjectType === 'team' ? <label><span>Confirmed team name</span><input value={draft.teamName} onChange={(event) => update({ teamName: event.target.value })} /></label> : null}
      <label>
        <span>Official announcement date</span>
        <input type="date" value={draft.sourcePublishedAt} onChange={(event) => update({ sourcePublishedAt: event.target.value })} />
      </label>
      <label>
        <span>Optional review note</span>
        <input value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder="Optional: why this is safe to publish" />
      </label>
      <div className="admin-actions">
        <button type="button" className="button-primary" disabled={isLoading} onClick={onApprove}>Approve for next daily publish</button>
        <button type="button" className="button-secondary" disabled={isLoading} onClick={onReject}>Reject — do not publish</button>
      </div>
      <p className="admin-publish-note"><strong>Step 3:</strong> Approval adds this to the next daily data refresh. It does not make a prediction or name anyone beyond the official source.</p>
    </section>
  );
}
