import { getViewerTimeZoneLabel } from '../lib/format.js';

export default function FilterBar({ filters, options, onChange, searchPlaceholder }) {
  const viewerTimeZoneLabel = getViewerTimeZoneLabel();

  return (
    <>
      <div className="timezone-note">
        Times are shown in your local timezone: <strong>{viewerTimeZoneLabel}</strong>. Each session also shows an LA reference time.
      </div>
      <div className="filters-grid">
        <label>
          <span>Sport</span>
          <select value={filters.sport} onChange={(event) => onChange({ ...filters, sport: event.target.value })}>
            <option value="all">All sports</option>
            {options.sportOptions.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Date (your timezone)</span>
          <select value={filters.dayKey} onChange={(event) => onChange({ ...filters, dayKey: event.target.value })}>
            <option value="all">All competition days</option>
            {options.dayOptions.map((dayKey) => (
              <option key={dayKey} value={dayKey}>
                {dayKey === 'time-tbd' ? 'Time not announced' : dayKey}
              </option>
            ))}
          </select>
        </label>
        <label className="search-field">
          <span>Search</span>
          <input
            type="search"
            value={filters.searchText}
            placeholder={searchPlaceholder}
            onChange={(event) => onChange({ ...filters, searchText: event.target.value })}
          />
        </label>
      </div>
    </>
  );
}
