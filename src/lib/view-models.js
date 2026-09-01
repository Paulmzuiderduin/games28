const EMPTY_COUNTRY = {
  noc: 'TBD',
  name: 'Unknown country',
  flag: 'TBD',
  continent: 'Unknown',
  profileSlug: 'unknown',
  medals: { gold: 0, silver: 0, bronze: 0, total: 0 }
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sortByDate(items) {
  return [...items].sort((left, right) => {
    const a = left.startAtUtc || left.changedAt || '';
    const b = right.startAtUtc || right.changedAt || '';
    return String(a).localeCompare(String(b));
  });
}

export function buildScheduleOptions(scheduleEntries) {
  const sportOptions = [...new Set(scheduleEntries.map((entry) => entry.sport).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const dayOptions = [...new Set(scheduleEntries.map((entry) => entry.dayKey).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  return { sportOptions, dayOptions };
}

export function filterScheduleEntries(scheduleEntries, filters) {
  const query = normalizeText(filters.searchText);

  return scheduleEntries.filter((entry) => {
    if (filters.sport !== 'all' && entry.sport !== filters.sport) {
      return false;
    }

    if (filters.dayKey !== 'all' && entry.dayKey !== filters.dayKey) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = normalizeText(`${entry.sport} ${entry.eventName} ${entry.phase} ${entry.venue} ${entry.sessionCode}`);
    return haystack.includes(query);
  });
}

export function filterCountries(countries, athleteCards, filters) {
  const favoriteSet = new Set(filters.favorites || []);
  const cardsByNoc = athleteCards.reduce((accumulator, card) => {
    accumulator.set(card.noc, (accumulator.get(card.noc) || 0) + 1);
    return accumulator;
  }, new Map());
  const query = normalizeText(filters.searchText);

  return countries
    .filter((country) => {
      if (filters.favoriteOnly && !favoriteSet.has(country.noc)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = normalizeText(`${country.noc} ${country.name} ${country.continent}`);
      return haystack.includes(query);
    })
    .sort((left, right) => {
      const favoriteDelta = Number(favoriteSet.has(right.noc)) - Number(favoriteSet.has(left.noc));
      if (favoriteDelta !== 0) {
        return favoriteDelta;
      }

      const cardDelta = (cardsByNoc.get(right.noc) || 0) - (cardsByNoc.get(left.noc) || 0);
      if (cardDelta !== 0) {
        return cardDelta;
      }

      return left.name.localeCompare(right.name);
    });
}

export function buildCountryDashboard(runtime, noc) {
  const country = runtime.countries.find((entry) => entry.noc === noc) || { ...EMPTY_COUNTRY, noc };
  const athleteCards = runtime.athleteCards.filter((card) => card.noc === noc);
  const namedAthletes = athleteCards.filter((card) => card.status === 'named');
  const quotaPlaces = athleteCards.filter((card) => card.status === 'quota');
  const confirmedSessions = sortByDate(
    runtime.scheduleEntries
      .filter((entry) => (entry.nocs || []).includes(noc) || (entry.athleteIds || []).some((id) => athleteCards.some((card) => card.id === id)))
      .map((entry) => {
        const linkedCard = athleteCards.find((card) => (entry.athleteIds || []).includes(card.id) || card.sport === entry.sport);
        return {
          ...entry,
          derivedStatus: 'confirmed',
          linkedQualificationId: linkedCard?.id || null,
          linkedQualificationLabel: linkedCard?.name || country.name
        };
      })
  );
  const confirmedSports = new Set(confirmedSessions.map((entry) => entry.sport).filter(Boolean));
  const awaitingScheduleGroups = [...athleteCards
    .filter((card) => !confirmedSports.has(card.sport))
    .reduce((groups, card) => {
      const disciplines = [...new Set(card.disciplines || [])].sort();
      const key = `${card.sport}::${disciplines.join('|')}`;
      const group = groups.get(key) || {
        id: key,
        sport: card.sport,
        disciplines,
        entryCount: 0,
        sourceUrl: card.sourceUrl || null
      };
      group.entryCount += 1;
      groups.set(key, group);
      return groups;
    }, new Map())
    .values()]
    .sort((left, right) => left.sport.localeCompare(right.sport));
  const changes = sortByDate(
    runtime.changes.filter((change) => change.noc === noc || athleteCards.some((card) => card.id === change.entityId))
  ).reverse();

  const latestUpdateAt = athleteCards
    .map((card) => card.lastUpdatedAt)
    .filter(Boolean)
    .sort((a, b) => String(b).localeCompare(String(a)))[0] || runtime.checkedAt;

  return {
    country,
    athleteCards,
    namedAthletes,
    quotaPlaces,
    confirmedSessions,
    awaitingScheduleGroups,
    changes,
    latestUpdateAt,
    stats: {
      namedAthleteCount: namedAthletes.length,
      quotaCount: quotaPlaces.length,
      confirmedSessionCount: confirmedSessions.length,
      awaitingScheduleGroupCount: awaitingScheduleGroups.length
    }
  };
}

export function buildHomeStats(runtime) {
  const sports = new Set(runtime.scheduleEntries.map((entry) => entry.sport).filter(Boolean));
  const countriesWithCards = new Set(runtime.athleteCards.map((card) => card.noc));

  return [
    {
      label: 'Sessions tracked',
      value: runtime.scheduleEntries.length
    },
    {
      label: 'Sports in schedule',
      value: sports.size
    },
    {
      label: 'Countries indexed',
      value: runtime.countries.length
    },
    {
      label: 'Countries with qualification data',
      value: countriesWithCards.size
    }
  ];
}
