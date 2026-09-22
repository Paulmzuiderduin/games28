import { useMemo } from 'react';
import AppLink from './AppLink.jsx';
import CountryFlag from './CountryFlag.jsx';

export default function CountryDirectory({ countries, athleteCards, favorites, onToggleFavorite }) {
  const qualificationCountByNoc = useMemo(() => {
    return athleteCards.reduce((accumulator, card) => {
      accumulator.set(card.noc, (accumulator.get(card.noc) || 0) + 1);
      return accumulator;
    }, new Map());
  }, [athleteCards]);

  return (
    <div className="country-grid">
      {countries.map((country) => {
        const count = qualificationCountByNoc.get(country.noc) || 0;
        return (
          <article key={country.noc} className="country-card">
            <div className="country-card-top">
              <div className="country-card-identity">
                <CountryFlag country={country} size="md" />
                <h3>{country.name}</h3>
              </div>
              <button
                type="button"
                className={`favorite-toggle ${favorites.includes(country.noc) ? 'active' : ''}`}
                onClick={() => onToggleFavorite(country.noc)}
              >
                {favorites.includes(country.noc) ? 'Saved' : 'Save'}
              </button>
            </div>
            <p>{country.noc} · {country.continent}</p>
            <div className="country-card-actions">
              <AppLink href={`/countries/${country.noc}`} className="text-link">
                Open dashboard
              </AppLink>
              <span>{count ? `${count} confirmed qualification records` : 'No confirmed records yet'}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
