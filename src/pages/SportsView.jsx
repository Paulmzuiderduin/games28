import { useState } from 'react';
import AppLink from '../components/AppLink.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SportIcon from '../components/SportIcon.jsx';
import { formatCount } from '../lib/format.js';
import { getSportPath } from '../lib/seo.js';

export default function SportsView({ sports }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSports = normalizedQuery
    ? sports.filter((sport) => sport.sport.toLowerCase().includes(normalizedQuery))
    : sports;

  return (
    <section className="page-section sports-directory-page">
      <div className="section-heading section-heading--flush">
        <div>
          <p className="eyebrow">Sports</p>
          <h1>Find your sport</h1>
        </div>
        <span className="status-pill">{formatCount(sports.length)} sports</span>
      </div>
      <p className="section-intro section-intro--flush">
        Open a sport page for its schedule, local session times, and confirmed qualification records.
      </p>
      <label className="search-field sport-directory-search">
        <span>Search sports</span>
        <input
          type="search"
          value={query}
          placeholder="Swimming, volleyball, athletics..."
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {filteredSports.length ? (
        <div className="sport-directory-grid">
          {filteredSports.map((sport) => (
            <AppLink key={sport.sport} href={getSportPath(sport.sport)} className="sport-directory-card">
              <div>
                <p className="eyebrow">{formatCount(sport.sessionCount)} sessions</p>
                <h2 className="sport-label"><SportIcon sport={sport.sport} /><span>{sport.sport}</span></h2>
                <p>{sport.qualificationRecordCount
                  ? `${sport.qualificationRecordCount} confirmed qualification ${sport.qualificationRecordCount === 1 ? 'record' : 'records'} across ${sport.qualificationCountryCount} ${sport.qualificationCountryCount === 1 ? 'country' : 'countries'}`
                  : 'Qualification records publish when officially confirmed'}</p>
              </div>
              <span className="row-arrow" aria-hidden="true">›</span>
            </AppLink>
          ))}
        </div>
      ) : (
        <EmptyState compact title="No matching sports" description="Try a broader sport name." />
      )}
    </section>
  );
}
