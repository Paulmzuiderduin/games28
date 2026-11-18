import { findVenue, venueAddress, eventOrganizer } from './venues.js';
import { buildSportQualificationOverview, buildCountryDashboard, getQualificationSportLabels } from './view-models.js';
import { getSportGroup } from './sport-groups.js';
import { countUniqueSessions, groupEntriesBySession } from './schedule-events.js';
import {
  SITE_NAME,
  SOCIAL_IMAGE_URL,
  getSessionPath,
  getSportPath,
  isCountryDashboardIndexable,
  routeUrl,
  selectSeoSessionEntries,
  findSportBySlug
} from './seo.js';
import { parseRoute } from './router.js';

function compact(value, fallback = '') {
  return String(value || fallback)
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDateTime(isoString) {
  if (!isoString || !Number.isFinite(Date.parse(isoString))) {
    return 'Time TBD';
  }

  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'short'
  }).format(new Date(isoString));
}

function formatShortDate(isoString) {
  if (!isoString || !Number.isFinite(Date.parse(isoString))) {
    return 'Date TBD';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles'
  }).format(new Date(isoString));
}

function seoTitle(primary, suffix = SITE_NAME, maxLength = 65) {
  const title = `${primary} | ${suffix}`;
  return title.length <= maxLength ? title : primary;
}

function joinList(values, maxItems = 4) {
  const items = values.filter(Boolean).slice(0, maxItems);
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const label = `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  return values.length > maxItems ? `${label}, and more` : label;
}

const SPORT_SEO_NAMES = {
  'Athletics (Marathon)': 'Olympic Marathon',
  'Athletics (Race Walk)': 'Race Walking',
  'Athletics (Track & Field)': 'Track & Field',
  Climbing: 'Sport Climbing',
  'Cycling Road (Road Race)': 'Road Cycling',
  'Cycling Road (Time Trial)': 'Road Cycling Time Trial',
  'Cycling Track': 'Track Cycling',
  'Football (Soccer)': 'Football',
  'Rowing Coastal Beach Sprints': 'Coastal Rowing',
  'Sailing (Dinghy, Skiff & Multihull)': 'Sailing - Dinghy & Skiff',
  'Sailing (Windsurfing & Kite)': 'Sailing - Windsurfing & Kite',
  'Shooting (Rifle & Pistol)': 'Shooting - Rifle & Pistol',
  'Shooting (Shotgun)': 'Shooting - Shotgun',
  'Skateboarding (Park)': 'Skateboarding Park',
  'Skateboarding (Street)': 'Skateboarding Street',
  'Slalom Paddle': 'Canoe Slalom',
  'Sprint Paddle': 'Canoe Sprint & Kayak'
};

const SPORT_CATEGORY_ORDER = [
  'Aquatics',
  'Archery',
  'Athletics',
  'Combat sports',
  'Cycling',
  'Equestrian',
  'Gymnastics',
  'Team sports',
  'Racket sports',
  'Sailing',
  'Shooting',
  'Board sports',
  'Other sports'
];

const SPORT_CATEGORIES = {
  'Artistic Swimming': 'Aquatics',
  Diving: 'Aquatics',
  'Open Water Swimming': 'Aquatics',
  Swimming: 'Aquatics',
  'Water Polo': 'Aquatics',
  Archery: 'Archery',
  'Athletics (Marathon)': 'Athletics',
  'Athletics (Race Walk)': 'Athletics',
  'Athletics (Track & Field)': 'Athletics',
  Boxing: 'Combat sports',
  Fencing: 'Combat sports',
  Judo: 'Combat sports',
  Taekwondo: 'Combat sports',
  Wrestling: 'Combat sports',
  'BMX Freestyle': 'Cycling',
  'BMX Racing': 'Cycling',
  'Cycling Road (Road Race)': 'Cycling',
  'Cycling Road (Time Trial)': 'Cycling',
  'Cycling Track': 'Cycling',
  'Mountain Bike': 'Cycling',
  Equestrian: 'Equestrian',
  'Artistic Gymnastics': 'Gymnastics',
  'Rhythmic Gymnastics': 'Gymnastics',
  'Trampoline Gymnastics': 'Gymnastics',
  '3x3 Basketball': 'Team sports',
  Baseball: 'Team sports',
  Basketball: 'Team sports',
  'Beach Volleyball': 'Team sports',
  Cricket: 'Team sports',
  'Flag Football': 'Team sports',
  'Football (Soccer)': 'Team sports',
  Handball: 'Team sports',
  Hockey: 'Team sports',
  Lacrosse: 'Team sports',
  'Rugby Sevens': 'Team sports',
  Softball: 'Team sports',
  Volleyball: 'Team sports',
  Badminton: 'Racket sports',
  Squash: 'Racket sports',
  'Table Tennis': 'Racket sports',
  Tennis: 'Racket sports',
  'Sailing (Dinghy, Skiff & Multihull)': 'Sailing',
  'Sailing (Windsurfing & Kite)': 'Sailing',
  'Shooting (Rifle & Pistol)': 'Shooting',
  'Shooting (Shotgun)': 'Shooting',
  'Skateboarding (Park)': 'Board sports',
  'Skateboarding (Street)': 'Board sports'
};

const QUALIFICATION_STATUS_LABELS = {
  watching: 'Being monitored; no confirmed allocation records yet',
  rules_published: 'Qualification rules published; allocations await official confirmation',
  review_required: 'Official confirmation records are under review',
  structured_live: 'Official allocation feed is live',
  final_entries_live: 'Final entries are live'
};

function sportSeoName(sport) {
  return SPORT_SEO_NAMES[sport] || sport;
}

function sportCategory(sport) {
  return SPORT_CATEGORIES[sport] || 'Other sports';
}

function findQualificationSystem(runtime, sport) {
  return (
    (runtime?.qualificationSystems || runtime?.meta?.qualificationSystems || []).find((system) => {
      const labels = [...(system.sports || []), ...(system.coveredSports || [])].map(getSportGroup);
      return labels.includes(sport);
    }) || null
  );
}

function qualificationSystemSection(runtime, sport) {
  const system = findQualificationSystem(runtime, sport);
  if (!system) return null;

  const name = sportSeoName(sport);
  const status = QUALIFICATION_STATUS_LABELS[system.status] || system.status || 'Being monitored';
  const documents = (system.iocDocuments || []).slice(0, 2);
  const items = [
    { text: `Status: ${status}` },
    { text: `Governing body: ${system.governingBody || 'International Federation'}` },
    ...(system.qualificationEvents?.length
      ? [{ text: `Qualification events: ${system.qualificationEvents.map((event) => event.label).join(', ')}` }]
      : []),
    ...documents.map((document) => ({
      text: `Official IOC qualification document: ${document.title}`,
      links: [{ href: document.url, label: 'Open IOC document' }]
    })),
    ...(!documents.length && system.rulesUrl
      ? [
          {
            text: `Official ${system.governingBody || 'International Federation'} qualification source`,
            links: [{ href: system.rulesUrl, label: 'Open official source' }]
          }
        ]
      : []),
    { text: `Games28 publishes a ${name} quota only after an official IOC, IF or NOC source confirms it.` }
  ];

  return { heading: `${name} qualification system and official sources`, items };
}

function keyFinalsSection(entries, sport, generatedSessionIds) {
  const finals = entries
    .filter(
      (entry) =>
        entry.startAtUtc && /\b(final|medal|gold|bronze)\b/i.test(`${entry.eventName} ${entry.description || ''}`)
    )
    .slice(0, 5);

  if (!finals.length) return null;

  return {
    heading: `Key ${sportSeoName(sport)} finals and medal sessions`,
    items: finals.map((entry) => ({
      text: `${entry.eventName} - ${formatDateTime(entry.startAtUtc)} - ${entry.venue || 'Venue TBC'}`,
      links: generatedSessionIds.has(entry.id)
        ? [{ href: getSessionPath(entry.id), label: 'Session details' }]
        : [{ href: getSportPath(sport), label: `${sportSeoName(sport)} schedule` }]
    }))
  };
}

function countrySports(cards) {
  return [...new Set(cards.map((card) => card.sport).filter(Boolean))];
}

function countryQuotaPlaces(cards) {
  return cards.reduce(
    (total, card) => total + (Number.isInteger(card.quotaCount) && card.quotaCount > 0 ? card.quotaCount : 1),
    0
  );
}

function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function qualificationSections(groups, sport, noc) {
  return groups
    .map((group) => ({
      heading: `${sport}: ${group.label}`,
      items: group.cards
        .filter((card) => !noc || card.noc === noc)
        .map((card) => ({
          text: `${card.country.name}: ${card.status === 'quota' ? `${card.quotaCount || 1} quota place(s)${card.quotaOccupants?.length ? `; selected: ${card.quotaOccupants.map((person) => person.name).join(', ')}` : '; athletes not yet selected'}` : `${card.name || 'Confirmed entry'} (${card.state || 'selected'})`}`,
          links: [
            { href: `/countries/${card.noc}`, label: card.country.name },
            { href: getSportPath(sport), label: sport },
            ...(card.sourceUrl ? [{ href: card.sourceUrl, label: 'Official source' }] : []),
            ...(card.quotaOccupants || [])
              .filter((person) => person.sourceUrl)
              .map((person) => ({ href: person.sourceUrl, label: `Selection source: ${person.name}` }))
          ]
        }))
    }))
    .filter((section) => section.items.length);
}

export function buildSessionSeoPage(entry, sessionEntries = [entry], { indexable = true, relatedSessions = [] } = {}) {
  const path = getSessionPath(entry.id);
  const venue = findVenue(entry.venue);
  const eventNames = [...new Set(sessionEntries.map((item) => item.eventName).filter(Boolean))];
  const sportName = sportSeoName(entry.sport);
  const shortDate = formatShortDate(entry.startAtUtc);
  const fullDate = formatDateTime(entry.startAtUtc);
  const venueName = entry.venue || 'Venue TBC';
  const related = relatedSessions
    .filter((item) => item.id !== entry.id && (item.sessionCode || item.id) !== (entry.sessionCode || entry.id))
    .slice(0, 4);
  const eventData =
    venue &&
    Number.isFinite(Date.parse(entry.startAtUtc)) &&
    entry.eventName &&
    entry.sport &&
    entry.venue &&
    !/^(tbd|tbc|n\/a|unknown)$/i.test(entry.venue.trim())
      ? {
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: `${entry.sport}: ${entry.eventName}`,
          startDate: entry.startAtUtc,
          endDate:
            Number.isFinite(Date.parse(entry.endAtUtc)) && Date.parse(entry.endAtUtc) > Date.parse(entry.startAtUtc)
              ? entry.endAtUtc
              : undefined,
          organizer: eventOrganizer,
          url: routeUrl(path),
          eventStatus:
            entry.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: {
            '@type': 'Place',
            name: venue.name,
            address: { '@type': 'PostalAddress', ...venue.address }
          },
          description: compact(`${entry.eventName} for ${entry.sport} at LA 2028. Source data is tracked by Games28.`)
        }
      : null;

  return {
    url: routeUrl(path),
    title: seoTitle(`${entry.eventName} - ${shortDate}`, `LA 2028 ${sportName}`),
    description: compact(
      `Session ${entry.sessionCode || entry.id}: ${entry.eventName} at ${venueName} on ${fullDate}. Start time, venue, related events and the full ${sportName} schedule.`
    ),
    heading: `${entry.sport}: ${entry.eventName}`,
    ...(indexable === false ? { indexable: false } : {}),
    sections: [
      {
        heading: 'Session overview',
        items: [
          { text: `${entry.eventName} is part of the ${sportName} programme at the LA 2028 Olympic Games.` },
          { text: `Date and time: ${fullDate}` },
          { text: `Venue: ${venueName}` },
          { text: `Session code: ${entry.sessionCode || 'TBD'}` }
        ]
      },
      ...(eventNames.length > 1
        ? [
            {
              heading: `All events in session ${entry.sessionCode}`,
              items: eventNames.map((name) => ({ text: name }))
            }
          ]
        : []),
      ...(related.length
        ? [
            {
              heading: `Related ${sportName} sessions`,
              items: related.map((item) => ({
                text: `${item.eventName} - ${formatDateTime(item.startAtUtc)} - ${item.venue || 'Venue TBC'}`,
                links: [{ href: getSessionPath(item.id), label: 'Session details' }]
              }))
            }
          ]
        : [])
    ],
    facts: [
      `Session ${entry.sessionCode || 'TBD'}`,
      sportName,
      ...(eventNames.length > 1 ? [`${eventNames.length} events in this session`] : []),
      venueName,
      ...(venue ? [venueAddress(venue)] : []),
      'Organized by LA28; Games28 is an independent guide',
      fullDate
    ],
    links: [
      { href: eventOrganizer.url, label: 'Official organizer: LA28' },
      ...(venue ? [{ href: venue.sourceUrl, label: 'Venue address source' }] : []),
      { href: getSportPath(entry.sport), label: `${sportName} schedule` },
      { href: '/schedule', label: 'Full LA 2028 schedule' },
      ...related.map((item) => ({ href: getSessionPath(item.id), label: item.eventName }))
    ],
    structuredData: [
      breadcrumbJsonLd([
        { name: 'Games28', url: routeUrl('/') },
        { name: entry.sport, url: routeUrl(getSportPath(entry.sport)) },
        { name: entry.eventName, url: routeUrl(path) }
      ]),
      eventData
    ].filter(Boolean)
  };
}

export function buildSeoPages(runtime, { sessionEntries = selectSeoSessionEntries(runtime.scheduleEntries) } = {}) {
  const sports = [...new Set(runtime.scheduleEntries.map((entry) => getSportGroup(entry.sport)).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
  const overviewBySport = new Map(
    sports.map((sport) => [sport, buildSportQualificationOverview(runtime, sport).groups])
  );
  const selectedSessions = sessionEntries;
  const generatedSessionIds = new Set(selectSeoSessionEntries(runtime.scheduleEntries).map((entry) => entry.id));
  const sessionCount = countUniqueSessions(runtime.scheduleEntries);
  const sessionGroups = new Map(
    groupEntriesBySession(runtime.scheduleEntries).map((group) => [group[0].sessionCode || group[0].id, group])
  );
  const relatedSessionPool = new Map();
  for (const entry of runtime.scheduleEntries) {
    if (!entry.id || !entry.startAtUtc || !entry.sport) continue;
    const sport = getSportGroup(entry.sport);
    const key = entry.sessionCode || entry.id;
    const pool = relatedSessionPool.get(sport) || [];
    if (pool.length >= 8 || pool.some((item) => (item.sessionCode || item.id) === key)) continue;
    pool.push(entry);
    relatedSessionPool.set(sport, pool);
  }

  const sportSections = SPORT_CATEGORY_ORDER.flatMap((category) => {
    const categorySports = sports.filter((sport) => sportCategory(sport) === category);
    return categorySports.length
      ? [
          {
            heading: `${category} at LA 2028`,
            items: categorySports.map((sport) => ({
              text: sportSeoName(sport),
              links: [{ href: getSportPath(sport), label: `${sportSeoName(sport)} schedule and qualification` }]
            }))
          }
        ]
      : [];
  });

  const countryDirectorySections = [...new Set(runtime.countries.map((country) => country.continent).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .map((continent) => ({
      heading: `${continent} country dashboards`,
      items: runtime.countries
        .filter((country) => country.continent === continent)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((country) => ({
          text: country.name,
          links: [{ href: `/countries/${country.noc}`, label: `${country.name} dashboard` }]
        }))
    }));

  const qualificationSourceCount = (runtime.meta?.qualificationSources || []).length;

  /** @type {any[]} */
  const pages = [
    {
      url: routeUrl('/'),
      title: seoTitle('LA 2028 Schedule, Qualification & Country Dashboards'),
      description: `Explore ${sessionCount} LA 2028 sessions across ${sports.length} sports, confirmed qualification records by country, local-time schedules and calendar exports.`,
      heading: 'LA 2028 schedule, qualification and country dashboards',
      facts: [
        `${runtime.countries.length} country dashboards`,
        `${sports.length} sports tracked`,
        'Times shown in each visitor local timezone'
      ],
      links: [
        { href: '/schedule', label: 'Full LA 2028 schedule' },
        { href: '/changes', label: 'Recent schedule changes' },
        { href: '/countries/NED', label: 'Netherlands dashboard' }
      ],
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: routeUrl('/'),
          description: 'Independent LA 2028 schedule explorer with country dashboards and calendar exports.'
        }
      ]
    },
    {
      url: routeUrl('/schedule'),
      title: seoTitle('LA 2028 Olympic Schedule: All Sessions & Times'),
      description:
        'Browse the full LA 2028 competition schedule by sport, date, venue, and session code, with local-time display, qualification links and calendar export.',
      heading: 'LA 2028 competition schedule',
      facts: [
        `${runtime.scheduleEntries.length} schedule entries`,
        'Local time plus LA reference time',
        'Export filtered sessions to calendar'
      ],
      links: sports.slice(0, 12).map((sport) => ({ href: getSportPath(sport), label: `${sport} schedule` }))
    },
    {
      url: routeUrl('/sports'),
      title: seoTitle('LA 2028 Olympic Sports: Full List & Schedules'),
      description: `All ${sports.length} sports at LA 2028, with session schedules, venues and confirmed qualification records by country. Find your sport and see who has qualified.`,
      heading: 'LA 2028 Olympic sports: full list',
      facts: [
        `${sports.length} sports tracked`,
        'Schedule and confirmed qualification information in one place',
        'Times shown in each visitor local timezone'
      ],
      sections: sportSections,
      links: sports
        .slice(0, 12)
        .map((sport) => ({ href: getSportPath(sport), label: `${sport} schedule and qualification` }))
    },
    {
      url: routeUrl('/changes'),
      title: seoTitle('LA 2028 Qualification & Schedule Changes'),
      description:
        'Track verified changes to the LA 2028 schedule and qualification records, including new quotas, selections, withdrawals and official source updates.',
      heading: 'Recent LA 2028 schedule and qualification changes',
      facts: [`${runtime.changes.length} tracked changes`, `Last checked ${runtime.checkedAt || 'pending'}`],
      sections: [
        {
          heading: 'What the change feed tracks',
          items: [
            { text: 'New official quota allocations by country and sport.' },
            { text: 'Named athlete and team selections after an NOC confirms them.' },
            { text: 'Schedule, session-time and venue corrections from the official LA28 source.' },
            { text: 'Withdrawals, replacements and other lifecycle changes without deleting history.' }
          ]
        }
      ],
      links: [{ href: '/schedule', label: 'Browse schedule' }]
    },
    {
      url: routeUrl('/sources'),
      title: seoTitle('LA 2028 Data Sources & Verification'),
      description:
        'See which official IOC, International Federation and NOC sources Games28 uses for LA 2028 schedule and qualification data, and how records are verified.',
      heading: 'Games28 data and sources',
      facts: [
        'Official sources only for published qualification records',
        `${qualificationSourceCount} qualification sources tracked`,
        `${runtime.qualificationSystems?.length || 0} qualification systems covered`,
        `Last checked ${runtime.checkedAt || 'pending'}`
      ],
      sections: [
        {
          heading: 'How verification works',
          items: [
            { text: 'Schedule data comes from the official LA28 By Event and By Session PDFs.' },
            {
              text: 'Qualification cards require an official IOC, IF, NOC or national-federation source URL and a source date.'
            },
            { text: 'Rankings, projections and media reports never create a published qualification card.' },
            { text: 'Pending and rejected review candidates stay auditable but are not published.' }
          ]
        }
      ],
      links: [
        { href: '/schedule', label: 'Browse schedule' },
        { href: '/countries', label: 'Browse country dashboards' }
      ]
    },
    {
      url: routeUrl('/report'),
      title: 'Report a Games28 Update | Games28',
      description:
        'Report a possible LA 2028 schedule correction or missing qualification to Games28. Every report is checked before anything is published.',
      heading: 'Report a Games28 update',
      indexable: false,
      facts: ['Reports stay private until reviewed', 'Official sources are required before publication'],
      links: [
        { href: '/schedule', label: 'Browse schedule' },
        { href: '/sources', label: 'Data and sources' }
      ]
    }
  ];

  pages.push(
    {
      url: routeUrl('/countries'),
      title: seoTitle('LA 2028 Countries: Qualification & Schedule'),
      description:
        'Follow every country at LA 2028 with confirmed qualification records, quota places, session schedules, official sources and local-time calendar exports.',
      heading: 'LA 2028 country dashboards',
      facts: [
        `${runtime.countries.length} countries tracked`,
        'Confirmed quotas and selections only',
        'Times shown in each visitor local timezone'
      ],
      sections: countryDirectorySections,
      links: runtime.countries.slice(0, 12).map((country) => ({
        href: `/countries/${country.noc}`,
        label: `${country.name} dashboard`
      }))
    },
    {
      url: routeUrl('/admin'),
      title: 'Private Review Console | Games28',
      description: 'Private Games28 qualification review console.',
      heading: 'Private review console',
      indexable: false
    }
  );

  runtime.countries.forEach((country) => {
    const indexable = isCountryDashboardIndexable(runtime, country.noc);
    const countryCards = runtime.athleteCards.filter((card) => card.noc === country.noc);
    const dashboard = buildCountryDashboard(runtime, country.noc);
    const confirmed = dashboard.confirmedSessions;
    const confirmedSessionCount = dashboard.stats.confirmedSessionCount;
    const countrySections = sports.flatMap((sport) =>
      qualificationSections(overviewBySport.get(sport), sport, country.noc)
    );
    const countrySportList = countrySports(countryCards);
    const quotaPlaces = countryQuotaPlaces(countryCards);
    const sportNames = countrySportList.map(sportSeoName);
    pages.push({
      url: routeUrl(`/countries/${country.noc}`),
      title: seoTitle(`${country.name} LA 2028: Qualification & Schedule`),
      sections: [
        ...countrySections,
        ...(confirmed.length
          ? [
              {
                heading: 'Confirmed sessions (Los Angeles time)',
                items: confirmed.map((entry) => ({
                  text: `${entry.eventName} - ${formatDateTime(entry.startAtUtc)}`,
                  links: generatedSessionIds.has(entry.id)
                    ? [{ href: getSessionPath(entry.id), label: 'Session details' }]
                    : [{ href: getSportPath(entry.sport), label: `${entry.sport} schedule` }]
                }))
              }
            ]
          : [])
      ],
      description: countryCards.length
        ? `${country.name} has ${quotaPlaces} confirmed LA 2028 quota place${quotaPlaces === 1 ? '' : 's'} in ${joinList(sportNames)}. See the schedule, official sources and qualification details.`
        : `Follow ${country.name} at LA 2028. Confirmed quotas, selections and sessions appear here only after official confirmation.`,
      heading: `${country.name} LA 2028 qualification and schedule`,
      facts: [
        `NOC ${country.noc}`,
        country.continent,
        `${countryCards.length} verified qualification record${countryCards.length === 1 ? '' : 's'} across ${countrySportList.length} sport${countrySportList.length === 1 ? '' : 's'}`,
        `${quotaPlaces} quota place${quotaPlaces === 1 ? '' : 's'}`,
        `${confirmedSessionCount} confirmed session${confirmedSessionCount === 1 ? '' : 's'}`,
        'A quota does not confirm an athlete selection or an appearance in a specific session.'
      ],
      indexable,
      links: [
        { href: '/schedule', label: 'Full schedule' },
        { href: '/changes', label: 'Recent changes' },
        ...countrySportList.slice(0, 4).map((sport) => ({
          href: getSportPath(sport),
          label: `${sportSeoName(sport)} schedule`
        }))
      ],
      structuredData: [
        breadcrumbJsonLd([
          { name: 'Games28', url: routeUrl('/') },
          { name: 'Countries', url: routeUrl('/countries') },
          { name: country.name, url: routeUrl(`/countries/${country.noc}`) }
        ])
      ]
    });
  });

  sports.forEach((sport) => {
    const entries = runtime.scheduleEntries.filter((entry) => getSportGroup(entry.sport) === sport);
    const entrySessionCount = countUniqueSessions(entries);
    const qualifications = runtime.athleteCards.filter((card) =>
      getQualificationSportLabels(runtime, card).includes(sport)
    );
    const qualificationCountries = new Set(qualifications.map((card) => card.noc)).size;
    const sportName = sportSeoName(sport);
    const hasQualifications = qualifications.length > 0;
    const venueCount = new Set(entries.map((entry) => entry.venue).filter(Boolean)).size;
    const system = findQualificationSystem(runtime, sport);
    const systemSection = qualificationSystemSection(runtime, sport);
    const keyFinals = keyFinalsSection(entries, sport, generatedSessionIds);
    pages.push({
      url: routeUrl(getSportPath(sport)),
      title: seoTitle(`${sportName} LA 2028: ${hasQualifications ? 'Qualification & Schedule' : 'Full Schedule'}`),
      sections: [
        ...qualificationSections(overviewBySport.get(sport), sport),
        ...(systemSection ? [systemSection] : []),
        ...(keyFinals ? [keyFinals] : []),
        {
          heading: 'Schedule preview (Los Angeles time)',
          items: entries.slice(0, 8).map((entry) => ({
            text: `${entry.eventName} — ${formatDateTime(entry.startAtUtc)} — ${entry.venue || 'Venue TBC'}`,
            links: generatedSessionIds.has(entry.id)
              ? [{ href: getSessionPath(entry.id), label: 'Session details' }]
              : []
          }))
        }
      ],
      description: hasQualifications
        ? `${sportName} at LA 2028: full schedule plus ${qualifications.length} confirmed quota place${qualifications.length === 1 ? '' : 's'} across ${qualificationCountries} countries. Session times, venues and official sources.`
        : `Full ${sportName} schedule for LA 2028 with session times, venues and calendar export. Qualification records are added only after official confirmation.`,
      heading: `${sportName} at LA 2028`,
      facts: [
        `${entrySessionCount} session${entrySessionCount === 1 ? '' : 's'} tracked`,
        `${venueCount} venue${venueCount === 1 ? '' : 's'}`,
        hasQualifications
          ? `${qualifications.length} confirmed quota place${qualifications.length === 1 ? '' : 's'} across ${qualificationCountries} countries`
          : 'No confirmed quota places yet',
        system
          ? `Qualification rules: ${system.governingBody}`
          : 'Qualification records publish only after official confirmation',
        'Times convert to each visitor local timezone'
      ],
      links: [
        ...entries
          .filter((entry) => generatedSessionIds.has(entry.id))
          .slice(0, 8)
          .map((entry) => ({
            href: getSessionPath(entry.id),
            label: compact(`${entry.eventName} ${entry.sessionCode}`)
          })),
        { href: '/sports', label: 'All LA 2028 sports' },
        { href: '/schedule', label: 'Full LA 2028 schedule' },
        ...(system?.rulesUrl ? [{ href: system.rulesUrl, label: 'Official qualification source' }] : [])
      ],
      structuredData: [
        breadcrumbJsonLd([
          { name: 'Games28', url: routeUrl('/') },
          { name: 'Sports', url: routeUrl('/sports') },
          { name: sport, url: routeUrl(getSportPath(sport)) }
        ])
      ]
    });
  });

  selectedSessions.forEach((entry) => {
    const relatedSessions = (relatedSessionPool.get(getSportGroup(entry.sport)) || []).filter(
      (item) => generatedSessionIds.has(item.id) && (item.sessionCode || item.id) !== (entry.sessionCode || entry.id)
    );
    pages.push(
      buildSessionSeoPage(entry, sessionGroups.get(entry.sessionCode || entry.id) || [entry], {
        relatedSessions
      })
    );
  });

  return pages;
}

const seoPagesCache = new WeakMap();
const sessionSeoPageCache = new WeakMap();

function cachedSeoPages(runtime) {
  let pages = seoPagesCache.get(runtime);
  if (!pages) {
    pages = buildSeoPages(runtime);
    seoPagesCache.set(runtime, pages);
  }
  return pages;
}

function cachedSessionSeoPage(runtime, entry) {
  let pages = sessionSeoPageCache.get(runtime);
  if (!pages) {
    pages = new Map();
    sessionSeoPageCache.set(runtime, pages);
  }
  let page = pages.get(entry.id);
  if (!page) {
    const sessionEntries = entry.sessionCode
      ? runtime.scheduleEntries.filter((item) => item.sessionCode === entry.sessionCode)
      : [entry];
    const relatedSessions = runtime.scheduleEntries
      .filter(
        (item) =>
          item.id &&
          item.startAtUtc &&
          getSportGroup(item.sport) === getSportGroup(entry.sport) &&
          (item.sessionCode || item.id) !== (entry.sessionCode || entry.id)
      )
      .slice(0, 4);
    page = buildSessionSeoPage(entry, sessionEntries, { indexable: false, relatedSessions });
    pages.set(entry.id, page);
  }
  return page;
}

export function getSeoPage(runtime, pathname) {
  const route = parseRoute(pathname);
  const entry =
    route.name === 'session'
      ? runtime.scheduleEntries.find((item) => item.id === route.sessionId || item.aliasIds?.includes(route.sessionId))
      : null;
  const sport = route.name === 'sport' ? findSportBySlug(runtime.scheduleEntries, route.sportSlug) : null;
  const path =
    route.name === 'country'
      ? `/countries/${route.noc}`
      : sport
        ? getSportPath(sport)
        : entry
          ? getSessionPath(entry.id)
          : pathname.replace(/\/+$/, '') || '/';
  const page = cachedSeoPages(runtime).find((item) => item.url === routeUrl(path));
  if (page) return page;
  if (entry) return cachedSessionSeoPage(runtime, entry);
  return {
    url: routeUrl(path),
    title: 'Page Not Found | Games28',
    description: 'Find LA 2028 country dashboards, sports and the competition schedule on Games28.',
    indexable: false
  };
}

export function seoHeadElements(page) {
  const meta = (key, value, property = false) => ({
    tag: 'meta',
    attributes: { [property ? 'property' : 'name']: key, content: value }
  });
  return [
    { tag: 'title', content: page.title },
    meta('description', page.description),
    meta('robots', page.indexable === false ? 'noindex,follow' : 'index,follow'),
    { tag: 'link', attributes: { rel: 'canonical', href: page.url } },
    meta('og:title', page.title, true),
    meta('og:description', page.description, true),
    meta('og:type', 'website', true),
    meta('og:url', page.url, true),
    meta('og:image', SOCIAL_IMAGE_URL, true),
    meta('twitter:card', 'summary_large_image'),
    meta('twitter:title', page.title),
    meta('twitter:description', page.description),
    meta('twitter:image', SOCIAL_IMAGE_URL),
    ...(page.structuredData || []).map((data) => ({
      tag: 'script',
      attributes: { type: 'application/ld+json' },
      content: JSON.stringify(data).replace(/</g, '\\u003c')
    }))
  ];
}

export function applySeoPage(page, doc = document) {
  doc.head
    .querySelectorAll(
      'title,meta[name="description"],meta[name="robots"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],script[type="application/ld+json"]'
    )
    .forEach((node) => node.remove());
  for (const { tag, attributes = {}, content } of seoHeadElements(page)) {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (content !== undefined) node.textContent = content;
    doc.head.appendChild(node);
  }
}
