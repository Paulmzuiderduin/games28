const EMPTY_COUNTRY = {
  noc: 'TBD',
  name: 'Unknown country',
  flag: 'TBD',
  continent: 'Unknown',
  profileSlug: 'unknown'
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueById(items) {
  const seen = new Set();
  const output = [];

  items.forEach((item) => {
    if (!item || seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    output.push(item);
  });

  return output;
}

function sortByDate(items) {
  return [...items].sort((left, right) => {
    const a = left.startAtUtc || left.changedAt || '';
    const b = right.startAtUtc || right.changedAt || '';
    return String(a).localeCompare(String(b));
  });
}

function buildQualificationTokens(card) {
  const rawHints = [];

  if (Array.isArray(card.scheduleHints)) {
    rawHints.push(...card.scheduleHints);
  }

  if (Array.isArray(card.disciplines)) {
    rawHints.push(...card.disciplines);
  }

  if (card.name) {
    rawHints.push(card.name);
  }

  return rawHints
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .flatMap((value) => value.split(' ').filter(Boolean))
    .filter((token) => token.length >= 3);
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
  const scheduleMatches = [];

  athleteCards.forEach((card) => {
    const tokens = buildQualificationTokens(card);
    runtime.scheduleEntries.forEach((entry) => {
      if (entry.sport !== card.sport) {
        return;
      }

      const combinedText = normalizeText(`${entry.eventName} ${entry.phase} ${entry.discipline}`);
      const matchesHint = !tokens.length || tokens.some((token) => combinedText.includes(token));
      if (!matchesHint) {
        return;
      }

      const confirmed = (entry.nocs || []).includes(noc) || (entry.athleteIds || []).includes(card.id);
      scheduleMatches.push({
        ...entry,
        derivedStatus: confirmed ? 'confirmed' : 'pending',
        linkedQualificationId: card.id,
        linkedQualificationLabel: card.name
      });
    });
  });

  const dedupedMatches = uniqueById(
    scheduleMatches.sort((left, right) => {
      if (left.id === right.id) {
        if (left.derivedStatus === right.derivedStatus) return 0;
        return left.derivedStatus === 'confirmed' ? -1 : 1;
      }
      return left.startAtUtc.localeCompare(right.startAtUtc);
    })
  );

  const confirmedSessions = dedupedMatches.filter((entry) => entry.derivedStatus === 'confirmed');
  const pendingSessions = dedupedMatches.filter((entry) => entry.derivedStatus === 'pending');
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
    pendingSessions,
    changes,
    latestUpdateAt,
    stats: {
      namedAthleteCount: namedAthletes.length,
      quotaCount: quotaPlaces.length,
      confirmedSessionCount: confirmedSessions.length,
      pendingSessionCount: pendingSessions.length
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
