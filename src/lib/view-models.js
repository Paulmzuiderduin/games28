import { formatCanonicalEventLabel, resolveCanonicalQualificationEvent } from './qualification-events.js';

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

export function getQualificationSportLabels(runtime, card) {
  const sources = runtime.meta?.qualificationSources || [];
  const matchingSources = sources.filter((source) => source.id === card.sourceId || source.sport === card.sport);
  const mappedSports = [...new Set(matchingSources.flatMap((source) => {
    const qualificationEvents = source.qualificationEvents || [];
    const directSportEvents = qualificationEvents.filter((event) => (event.sports || []).includes(card.sport));

    // Some governing bodies cover related Olympic sports. Prefer the record's
    // explicit sport over the entire governing-body group (for example indoor
    // volleyball must not also appear on the beach volleyball page).
    if (directSportEvents.length) {
      return directSportEvents.flatMap((event) => event.sports || []);
    }

    return source.sports || [];
  }).filter(Boolean))];

  return mappedSports.length ? mappedSports : [card.sport].filter(Boolean);
}

export function buildSportDirectory(runtime) {
  const sports = new Map();

  (runtime.scheduleEntries || []).forEach((entry) => {
    if (!entry.sport) return;
    const summary = sports.get(entry.sport) || {
      sport: entry.sport,
      sessionCount: 0,
      venues: new Set(),
      qualificationRecordCount: 0,
      qualificationCountries: new Set()
    };
    summary.sessionCount += 1;
    if (entry.venue) summary.venues.add(entry.venue);
    sports.set(entry.sport, summary);
  });

  (runtime.athleteCards || []).forEach((card) => {
    getQualificationSportLabels(runtime, card).forEach((sport) => {
      const summary = sports.get(sport);
      if (!summary) return;
      summary.qualificationRecordCount += 1;
      if (card.noc) summary.qualificationCountries.add(card.noc);
    });
  });

  return [...sports.values()]
    .map((summary) => ({
      ...summary,
      venueCount: summary.venues.size,
      qualificationCountryCount: summary.qualificationCountries.size
    }))
    .sort((left, right) => left.sport.localeCompare(right.sport));
}

export function filterScheduleEntries(scheduleEntries, filters) {
  const query = normalizeText(filters.searchText);
  const exactRoundQuery = new Set(['final', 'finals', 'semifinal', 'semifinals', 'quarterfinal', 'quarterfinals']).has(query);

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

    const haystack = normalizeText(`${entry.sport} ${entry.eventName} ${entry.venue} ${entry.sessionCode}`);
    if (exactRoundQuery) {
      return new RegExp(`\\b${query}\\b`).test(haystack);
    }
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

function qualificationStatusRank(card) {
  const state = String(card.state || '').toLowerCase();
  const status = String(card.status || '').toLowerCase();

  if (state === 'entered') return 0;
  if (state === 'selected') return 1;
  if (status === 'named') return 2;
  if (state === 'earned') return 3;
  if (state === 'allocated' || status === 'quota') return 4;
  return 5;
}

function qualificationGroupLabel(runtime, card, sport) {
  const canonicalEvent = card.canonicalEventLabel
    ? { label: card.canonicalEventLabel }
    : resolveCanonicalQualificationEvent(card, runtime.meta?.qualificationSources || []);
  if (canonicalEvent?.label) {
    return formatCanonicalEventLabel(canonicalEvent.label, sport);
  }

  const disciplines = [...new Set(card.disciplines || [])].filter(Boolean).sort((left, right) => left.localeCompare(right));
  if (!disciplines.length) return 'All qualification events';

  // Official announcements use both "Women's beach volleyball" and
  // "Beach Volleyball - Women's tournament" for the same Olympic event.
  // Present one concise, consistent event label on the sport page.
  if (sport === 'Beach Volleyball' && disciplines.length === 1) {
    const discipline = normalizeText(disciplines[0]);
    if (discipline.includes('women') && (discipline.includes('beach volleyball') || discipline.includes('tournament'))) {
      return "Women's tournament";
    }
    if (discipline.includes('men') && (discipline.includes('beach volleyball') || discipline.includes('tournament'))) {
      return "Men's tournament";
    }
  }

  return disciplines.join(' / ');
}

export function buildSportQualificationOverview(runtime, sport) {
  const countryByNoc = new Map((runtime.countries || []).map((country) => [country.noc, country]));
  const cards = (runtime.athleteCards || [])
    .filter((card) => getQualificationSportLabels(runtime, card).includes(sport))
    .sort((left, right) => {
      const statusDelta = qualificationStatusRank(left) - qualificationStatusRank(right);
      if (statusDelta !== 0) return statusDelta;

      const countryDelta = String(countryByNoc.get(left.noc)?.name || left.noc).localeCompare(String(countryByNoc.get(right.noc)?.name || right.noc));
      if (countryDelta !== 0) return countryDelta;

      return String(left.name).localeCompare(String(right.name));
    });
  const groups = new Map();

  cards.forEach((card) => {
    const label = qualificationGroupLabel(runtime, card, sport);
    const group = groups.get(label) || {
      id: `${sport}::${label}`,
      label,
      cards: [],
      countries: new Set()
    };

    group.cards.push({
      ...card,
      country: countryByNoc.get(card.noc) || { ...EMPTY_COUNTRY, noc: card.noc, name: card.noc }
    });
    group.countries.add(card.noc);
    groups.set(label, group);
  });

  const groupedQualifications = [...groups.values()]
    .map((group) => ({
      ...group,
      countryCount: group.countries.size
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const namedCount = cards.filter((card) => card.status === 'named' || ['selected', 'entered'].includes(card.state)).length;
  const quotaCount = cards.filter((card) => card.status === 'quota' || (card.status !== 'named' && ['allocated', 'earned'].includes(card.state))).length;

  return {
    cards,
    groups: groupedQualifications,
    stats: {
      countryCount: new Set(cards.map((card) => card.noc)).size,
      recordCount: cards.length,
      namedCount,
      quotaCount
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
