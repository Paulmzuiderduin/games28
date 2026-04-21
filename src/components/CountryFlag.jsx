export default function CountryFlag({ country, className = '' }) {
  if (country?.flagMode === 'flag-icons' && country?.iso2) {
    return (
      <span
        className={`country-flag flag-icon fi fi-${country.iso2} ${className}`.trim()}
        role="img"
        aria-label={`${country.name} flag`}
      />
    );
  }

  return <span className={`country-badge ${className}`.trim()}>{country?.noc || 'NOC'}</span>;
}
