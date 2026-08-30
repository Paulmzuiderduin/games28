import { useEffect, useState } from 'react';
import {
  getAdminSession,
  getReviewCandidates,
  isSupabaseConfigured,
  requestAdminMagicLink,
  resolveReviewCandidate,
  signOutAdmin
} from '../lib/supabase.js';

function localCandidateUrl() {
  const base = import.meta.env.VITE_DATA_BASE_URL || '';
  return `${base.replace(/\/$/, '')}/qualification-ingestion.json` || '/qualification-ingestion.json';
}

export default function AdminReviewConsole({ countries = [], qualificationSources = [] }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState({ noc: '', sport: '', subjectType: 'noc_quota', state: 'allocated', athleteName: '', teamName: '', quotaCount: '1', sourcePublishedAt: '' });
  const [note, setNote] = useState('');

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
          source_url: candidate.sourceUrl
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

  function beginReview(candidate) {
    const source = qualificationSources.find((entry) => entry.id === candidate.source_id || entry.id === candidate.sourceId);
    setDraft({
      noc: '',
      sport: source?.sport || '',
      subjectType: 'noc_quota',
      state: 'allocated',
      athleteName: '',
      teamName: '',
      quotaCount: '1',
      sourcePublishedAt: String(candidate.detected_at || candidate.detectedAt || '').slice(0, 10)
    });
  }

  function buildConfirmationRecord(candidate) {
    if (!draft.noc || !draft.sport || !draft.sourcePublishedAt) throw new Error('Choose a country, sport, and official publication date.');
    if (draft.subjectType === 'athlete' && !draft.athleteName.trim()) throw new Error('Add the confirmed athlete name.');
    if (draft.subjectType === 'team' && !draft.teamName.trim()) throw new Error('Add the confirmed team name.');
    if (draft.subjectType === 'noc_quota' && (!Number.isInteger(Number(draft.quotaCount)) || Number(draft.quotaCount) < 1)) throw new Error('Quota places must be at least 1.');
    return {
      id: `approved-${candidate.id}`,
      noc: draft.noc,
      sport: draft.sport,
      subjectType: draft.subjectType,
      state: draft.state,
      athleteName: draft.subjectType === 'athlete' ? draft.athleteName.trim() : null,
      teamName: draft.subjectType === 'team' ? draft.teamName.trim() : null,
      quotaCount: draft.subjectType === 'noc_quota' ? Number(draft.quotaCount) : null,
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
      setMessage(`Candidate ${status}. The next data refresh will publish approved records after validation.`);
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
        {candidates.length ? candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} />) : <p className="supporting-copy">No review candidates are waiting right now.</p>}
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
          <h1>Qualification evidence queue</h1>
          <p>{session.user.email}</p>
        </div>
        <button type="button" className="button-secondary" onClick={() => signOutAdmin().then(() => setSession(null))}>Sign out</button>
      </div>
      {message ? <p className="timezone-note">{message}</p> : null}
      {candidates.filter((candidate) => candidate.status === 'pending').map((candidate) => (
        <div className="admin-candidate" key={candidate.id}>
          <CandidateCard candidate={candidate} onReview={() => beginReview(candidate)} />
          <label>
            <span>Country</span>
            <select value={draft.noc} onChange={(event) => setDraft({ ...draft, noc: event.target.value })}>
              <option value="">Choose country</option>
              {countries.map((country) => <option key={country.noc} value={country.noc}>{country.name} ({country.noc})</option>)}
            </select>
          </label>
          <label>
            <span>Sport or qualification system</span>
            <input value={draft.sport} onChange={(event) => setDraft({ ...draft, sport: event.target.value })} placeholder="e.g. Cycling" />
          </label>
          <div className="admin-form-row">
            <label>
              <span>Confirmation type</span>
              <select value={draft.subjectType} onChange={(event) => setDraft({ ...draft, subjectType: event.target.value })}>
                <option value="noc_quota">Country quota</option>
                <option value="athlete">Named athlete</option>
                <option value="team">Named team</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={draft.state} onChange={(event) => setDraft({ ...draft, state: event.target.value })}>
                <option value="allocated">Allocated</option>
                <option value="earned">Earned</option>
                <option value="selected">Selected</option>
                <option value="entered">Final entry</option>
              </select>
            </label>
          </div>
          {draft.subjectType === 'noc_quota' ? <label><span>Confirmed quota places</span><input type="number" min="1" value={draft.quotaCount} onChange={(event) => setDraft({ ...draft, quotaCount: event.target.value })} /></label> : null}
          {draft.subjectType === 'athlete' ? <label><span>Athlete name</span><input value={draft.athleteName} onChange={(event) => setDraft({ ...draft, athleteName: event.target.value })} /></label> : null}
          {draft.subjectType === 'team' ? <label><span>Team name</span><input value={draft.teamName} onChange={(event) => setDraft({ ...draft, teamName: event.target.value })} /></label> : null}
          <label>
            <span>Official publication date</span>
            <input type="date" value={draft.sourcePublishedAt} onChange={(event) => setDraft({ ...draft, sourcePublishedAt: event.target.value })} />
          </label>
          <label>
            <span>Review note</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why this decision is safe" />
          </label>
          <div className="admin-actions">
            <button type="button" className="button-primary" disabled={isLoading} onClick={() => resolve(candidate, 'approved')}>Approve</button>
            <button type="button" className="button-secondary" disabled={isLoading} onClick={() => resolve(candidate, 'rejected')}>Reject</button>
          </div>
        </div>
      ))}
      {!isLoading && !candidates.some((candidate) => candidate.status === 'pending') ? <p className="supporting-copy">No candidates are waiting for a decision.</p> : null}
    </section>
  );
}

function CandidateCard({ candidate, onReview }) {
  return (
    <article className="info-card admin-candidate-card">
      <p className="eyebrow">{candidate.status || 'pending'}</p>
      <h2>{candidate.source_id || candidate.sourceId}</h2>
      <p>{candidate.extracted_evidence || candidate.extractedEvidence}</p>
      <p>{candidate.reason}</p>
      <a className="text-link" href={candidate.source_url || candidate.sourceUrl} target="_blank" rel="noreferrer">Open official source</a>
      {onReview ? <button type="button" className="text-button" onClick={onReview}>Use this evidence</button> : null}
    </article>
  );
}
