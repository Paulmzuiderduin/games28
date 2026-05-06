export default function CountryFlag({ country, size = 'md', className = '' }) {
  const sizeClass = `country-flag--${size}`;

  if (country?.flagMode === 'flag-icons' && country?.iso2) {
    return (
      <span
        className={`country-flag ${sizeClass} flag-icon fi fi-${country.iso2} ${className}`.trim()}
        role="img"
        aria-label={`${country.name} flag`}
      />
    );
  }

  return <span className={`country-badge ${sizeClass} ${className}`.trim()}>{country?.noc || 'NOC'}</span>;
}
