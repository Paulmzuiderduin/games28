import { useMemo, useState } from 'react';
import { isSupabaseConfigured, submitCommunityReport } from '../lib/supabase.js';

const EMPTY_REPORT = {
  category: 'missing_qualification',
  noc: '',
  sport: '',
  sourceUrl: '',
  details: '',
  reporterEmail: '',
  website: ''
};

export default function ReportUpdateForm({ countries = [], scheduleEntries = [] }) {
  const [report, setReport] = useState(EMPTY_REPORT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const sports = useMemo(() => [...new Set(scheduleEntries.map((entry) => entry.sport).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right)), [scheduleEntries]);

  function update(changes) {
    setReport((current) => ({ ...current, ...changes }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setMessage('Reporting is temporarily unavailable. Please try again later.');
      return;
    }
    if (report.website) return;
    setIsSubmitting(true);
    setMessage('');
    try {
      await submitCommunityReport(report);
      setReport(EMPTY_REPORT);
      setMessage('Thanks - your report is private and is now waiting for review. Games28 only publishes information confirmed by an official source.');
    } catch (error) {
      setMessage(error.message || 'Your report could not be sent. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel page-section report-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Help improve Games28</p>
          <h1>Report an update</h1>
          <p>Spotted a schedule mistake or a qualification that Games28 has missed? Send the official link and the details you found.</p>
        </div>
      </div>
      <section className="report-guidance" aria-label="What happens next">
        <p><strong>1. Send what you found.</strong> An official link is especially helpful.</p>
        <p><strong>2. It stays private.</strong> A Games28 admin checks every report.</p>
        <p><strong>3. No predictions.</strong> We only publish information confirmed by an IOC, LA28, federation, or NOC source.</p>
      </section>
      <form className="report-form" onSubmit={submit}>
        <label>
          <span>What are you reporting?</span>
          <select value={report.category} onChange={(event) => update({ category: event.target.value })}>
            <option value="missing_qualification">A qualification Games28 missed</option>
            <option value="schedule_correction">A schedule correction</option>
            <option value="qualification_correction">A qualification correction</option>
            <option value="other">Something else</option>
          </select>
        </label>
        <div className="report-form__row">
          <label>
            <span>Country (optional)</span>
            <select value={report.noc} onChange={(event) => update({ noc: event.target.value })}>
              <option value="">No country specified</option>
              {countries.map((country) => <option key={country.noc} value={country.noc}>{country.name}</option>)}
            </select>
          </label>
          <label>
            <span>Sport (optional)</span>
            <select value={report.sport} onChange={(event) => update({ sport: event.target.value })}>
              <option value="">No sport specified</option>
              {sports.map((sport) => <option key={sport} value={sport}>{sport}</option>)}
            </select>
          </label>
        </div>
        <label>
          <span>Official source link (recommended)</span>
          <input type="url" value={report.sourceUrl} onChange={(event) => update({ sourceUrl: event.target.value })} placeholder="https://..." />
          <small>Please link to LA28, the IOC, an international federation, an NOC, or a national federation where possible.</small>
        </label>
        <label>
          <span>What should we check?</span>
          <textarea value={report.details} onChange={(event) => update({ details: event.target.value })} minLength="20" maxLength="3000" required placeholder="For example: Country, athlete or team, event, and what the official source confirms." />
        </label>
        <label className="report-form__honeypot" aria-hidden="true">
          <span>Leave this empty</span>
          <input tabIndex="-1" autoComplete="off" value={report.website} onChange={(event) => update({ website: event.target.value })} />
        </label>
        <label>
          <span>Email address (optional)</span>
          <input type="email" value={report.reporterEmail} onChange={(event) => update({ reporterEmail: event.target.value })} placeholder="Only if you want us to contact you" />
        </label>
        <div className="report-form__actions">
          <button className="button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending report...' : 'Send report'}</button>
          <p>Your details are only used to review this report. Nothing is published automatically.</p>
        </div>
      </form>
      {message ? <p className="timezone-note" role="status">{message}</p> : null}
    </section>
  );
}
