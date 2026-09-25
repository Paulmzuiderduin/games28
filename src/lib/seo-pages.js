import { findVenue, venueAddress, eventOrganizer } from './venues.js';
import { buildSportQualificationOverview, buildCountryDashboard } from './view-models.js';
import { getSportGroup } from './sport-groups.js';
import { SITE_NAME, SOCIAL_IMAGE_URL, getSessionPath, getSportPath, isCountryDashboardIndexable, routeUrl, selectSeoSessionEntries, findSportBySlug } from './seo.js';
import { getQualificationSportLabels } from './view-models.js';
import { parseRoute } from './router.js';

function compact(value, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
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
  return groups.map(group => ({
    heading: `${sport}: ${group.label}`,
    items: group.cards.filter(card => !noc || card.noc === noc).map(card => ({
      text: `${card.country.name}: ${card.status === 'quota' ? `${card.quotaCount || 1} quota place(s)${card.quotaOccupants?.length ? `; selected: ${card.quotaOccupants.map(person => person.name).join(', ')}` : '; athletes not yet selected'}` : `${card.name || 'Confirmed entry'} (${card.state || 'selected'})`}`,
      links: [{ href: `/countries/${card.noc}`, label: card.country.name }, { href: getSportPath(sport), label: sport }, ...(card.sourceUrl ? [{ href: card.sourceUrl, label: 'Official source' }] : []), ...(card.quotaOccupants || []).filter(person => person.sourceUrl).map(person => ({ href: person.sourceUrl, label: `Selection source: ${person.name}` }))]

    }))
  })).filter(section => section.items.length);
}

export function buildSeoPages(runtime, { sessionEntries = selectSeoSessionEntries(runtime.scheduleEntries) } = {}) {
  const sports = [...new Set(runtime.scheduleEntries.map((entry) => getSportGroup(entry.sport)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  const overviewBySport = new Map(sports.map(sport => [sport, buildSportQualificationOverview(runtime, sport).groups]));
  const selectedSessions = sessionEntries;
  const generatedSessionIds = new Set(selectSeoSessionEntries(runtime.scheduleEntries).map(entry => entry.id));
  const pages = [
    {
      url: routeUrl('/'),
      title: 'Games28 | LA 2028 Schedule and Country Dashboards',
      description: `Explore ${runtime.meta.scheduleCount || runtime.scheduleEntries.length} LA 2028 sessions across ${sports.length} sports with local-time schedule views, country dashboards, and calendar exports.`,
      heading: 'Games28 LA 2028 schedule and country dashboards',
      facts: [`${runtime.countries.length} country dashboards`, `${sports.length} sports tracked`, 'Times shown in each visitor local timezone'],
      links: [
        { href: '/schedule', label: 'Full LA 2028 schedule' },
        { href: '/changes', label: 'Recent schedule changes' },
        { href: '/countries/NED', label: 'Netherlands dashboard' }
      ],
      structuredData: [{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: routeUrl('/'),
        description: 'Independent LA 2028 schedule explorer with country dashboards and calendar exports.'
      }]
    },
    {
      url: routeUrl('/schedule'),
      title: 'LA 2028 Schedule | Games28',
      description: 'Browse the LA 2028 competition schedule by sport, date, venue, and session code, with local-time display and calendar export.',
      heading: 'LA 2028 competition schedule',
      facts: [`${runtime.scheduleEntries.length} schedule entries`, 'Local time plus LA reference time', 'Export filtered sessions to calendar'],
      links: sports.slice(0, 12).map((sport) => ({ href: getSportPath(sport), label: `${sport} schedule` }))
    },
    {
      url: routeUrl('/sports'),
      title: 'LA 2028 Sports Directory | Games28',
      description: `Find all ${sports.length} LA 2028 sport pages, each with a schedule, local-time sessions, and confirmed qualification records when available.`,
      heading: 'Find your LA 2028 sport',
      facts: [`${sports.length} sports tracked`, 'Schedule and confirmed qualification information in one place', 'Times shown in each visitor local timezone'],
      links: sports.map((sport) => ({ href: getSportPath(sport), label: `${sport} schedule and qualification` }))
    },
    {
      url: routeUrl('/changes'),
      title: 'LA 2028 Schedule Changes | Games28',
      description: 'Track Games28 schedule and qualification data changes as the LA 2028 dataset refreshes.',
      heading: 'Recent LA 2028 schedule and qualification changes',
      facts: [`${runtime.changes.length} tracked changes`, `Last checked ${runtime.checkedAt || 'pending'}`],
      links: [{ href: '/schedule', label: 'Browse schedule' }]
    },
    {
      url: routeUrl('/sources'),
      title: 'Games28 Data & Sources | Games28',
      description: 'See how Games28 verifies LA 2028 schedule and qualification data, including official source coverage and refresh status.',
      heading: 'Games28 data and sources',
      facts: ['Official sources only for published qualification records', `Last checked ${runtime.checkedAt || 'pending'}`],
      links: [
        { href: '/schedule', label: 'Browse schedule' },
        { href: '/countries', label: 'Browse country dashboards' }
      ]
    },
    {
      url: routeUrl('/report'),
      title: 'Report a Games28 Update | Games28',
      description: 'Report a possible LA 2028 schedule correction or missing qualification to Games28. Every report is checked before anything is published.',
      heading: 'Report a Games28 update',
      indexable: false,
      facts: ['Reports stay private until reviewed', 'Official sources are required before publication'],
      links: [
        { href: '/schedule', label: 'Browse schedule' },
        { href: '/sources', label: 'Data and sources' }
      ]
    }
  ];

  pages.push({
    url: routeUrl('/countries'), title: 'LA 2028 Country Dashboards | Games28',
    description: 'Find your country and follow verified LA 2028 qualifications, schedule updates and calendar exports.',
    heading: 'Find your country',
    links: runtime.countries.map(country => ({ href: `/countries/${country.noc}`, label: country.name }))
  }, {
    url: routeUrl('/admin'), title: 'Private Review Console | Games28',
    description: 'Private Games28 qualification review console.', heading: 'Private review console', indexable: false
  });

  runtime.countries.forEach((country) => {
    const indexable = isCountryDashboardIndexable(runtime, country.noc);
    const countryCards = runtime.athleteCards.filter(card => card.noc === country.noc);
    const confirmed = buildCountryDashboard(runtime, country.noc).confirmedSessions;
    const countrySections = sports.flatMap(sport => qualificationSections(overviewBySport.get(sport), sport, country.noc));
    pages.push({
      url: routeUrl(`/countries/${country.noc}`),
      title: `${country.name} LA 2028 Qualifications and Schedule | Games28`,
      sections: [...countrySections, ...(confirmed.length ? [{ heading: 'Confirmed sessions (Los Angeles time)', items: confirmed.map(entry => ({ text: `${entry.eventName} - ${formatDateTime(entry.startAtUtc)}`, links: generatedSessionIds.has(entry.id) ? [{ href: getSessionPath(entry.id), label: 'Session details' }] : [{ href: getSportPath(entry.sport), label: `${entry.sport} schedule` }] })) }] : [])],
      description: countryCards.length ? `Explore ${country.name}'s ${countryCards.length} verified LA 2028 qualification records, official sources and ${confirmed.length} confirmed sessions. Quotas and athlete selections are shown separately.` : `Follow ${country.name} at LA 2028. Confirmed qualifications and sessions will appear when verified; no predicted entries.`,
      heading: `${country.name} LA 2028 schedule dashboard`,
      facts: [`NOC ${country.noc}`, country.continent, `${countryCards.length} verified qualification records; ${confirmed.length} confirmed sessions`, 'A quota does not confirm an athlete selection or an appearance in a specific session.'],
      indexable,
      links: [
        { href: '/schedule', label: 'Full schedule' },
        { href: '/changes', label: 'Recent changes' }
      ],
      structuredData: [breadcrumbJsonLd([
        { name: 'Games28', url: routeUrl('/') },
        { name: 'Countries', url: routeUrl('/countries') },
        { name: country.name, url: routeUrl(`/countries/${country.noc}`) }
      ])]
    });
  });

  sports.forEach((sport) => {
    const entries = runtime.scheduleEntries.filter((entry) => getSportGroup(entry.sport) === sport);
    const qualifications = runtime.athleteCards.filter((card) => getQualificationSportLabels(runtime, card).includes(sport));
    const qualificationCountries = new Set(qualifications.map((card) => card.noc)).size;
    pages.push({
      url: routeUrl(getSportPath(sport)),
      title: `${sport} LA 2028 Qualifications and Schedule | Games28`,
      sections: [...qualificationSections(overviewBySport.get(sport), sport), { heading: 'Schedule preview (Los Angeles time)', items: entries.slice(0, 8).map(entry => ({ text: `${entry.eventName} — ${formatDateTime(entry.startAtUtc)} — ${entry.venue || 'Venue TBC'}`, links: generatedSessionIds.has(entry.id) ? [{ href: getSessionPath(entry.id), label: 'Session details' }] : [] })) }],
      description: qualifications.length
        ? `Browse the ${sport} LA 2028 schedule plus ${qualifications.length} confirmed qualification records across ${qualificationCountries} countries, with official source links and calendar export.`
        : `Browse the ${sport} LA 2028 schedule with session times, venues, source links, and calendar export.`,
      heading: `${sport} LA 2028 schedule`,
      facts: [
        `${entries.length} sessions tracked`,
        `${new Set(entries.map((entry) => entry.venue).filter(Boolean)).size} venues`,
        qualifications.length ? `${qualifications.length} confirmed qualification records across ${qualificationCountries} countries` : 'Qualification records publish only after official confirmation',
        'Times convert to each visitor local timezone'
      ],
      links: entries.filter(entry => generatedSessionIds.has(entry.id)).slice(0, 8).map((entry) => ({ href: getSessionPath(entry.id), label: compact(`${entry.eventName} ${entry.sessionCode}`) })),
      structuredData: [breadcrumbJsonLd([
        { name: 'Games28', url: routeUrl('/') },
        { name: 'Sports', url: routeUrl('/sports') },
        { name: sport, url: routeUrl(getSportPath(sport)) }
      ])]
    });
  });

  selectedSessions.forEach((entry) => {
    const path = getSessionPath(entry.id);
    const venue = findVenue(entry.venue);
    const eventData = venue && Number.isFinite(Date.parse(entry.startAtUtc)) && entry.eventName && entry.sport && entry.venue && !/^(tbd|tbc|n\/a|unknown)$/i.test(entry.venue.trim()) ? {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: `${entry.sport}: ${entry.eventName}`,
      startDate: entry.startAtUtc,
      endDate: Number.isFinite(Date.parse(entry.endAtUtc)) && Date.parse(entry.endAtUtc) > Date.parse(entry.startAtUtc) ? entry.endAtUtc : undefined,
      organizer: eventOrganizer,
      url: routeUrl(path),
      eventStatus: entry.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: venue.name,
        address: { '@type': 'PostalAddress', ...venue.address }
      },
      description: compact(`${entry.eventName} for ${entry.sport} at LA 2028. Source data is tracked by Games28.`)
    } : null;

    pages.push({
      url: routeUrl(path),
      title: `${entry.eventName} LA 2028 ${entry.sport} Session | Games28`,
      description: `Session details for ${entry.eventName} in ${entry.sport} at LA 2028, including local-time display, LA reference time, venue, and calendar export.`,
      heading: `${entry.sport}: ${entry.eventName}`,
      facts: [
        `Session ${entry.sessionCode || 'TBD'}`,
        `${entry.venue || 'Venue TBC'}`,
        ...(venue ? [venueAddress(venue)] : []),
        'Organized by LA28; Games28 is an independent guide',
        formatDateTime(entry.startAtUtc)
      ],
      links: [
        { href: eventOrganizer.url, label: 'Official organizer: LA28' },
        ...(venue ? [{ href: venue.sourceUrl, label: 'Venue address source' }] : []),
        { href: getSportPath(entry.sport), label: `${entry.sport} schedule` },
        { href: '/schedule', label: 'Full LA 2028 schedule' }
      ],
      structuredData: [
        breadcrumbJsonLd([
          { name: 'Games28', url: routeUrl('/') },
          { name: entry.sport, url: routeUrl(getSportPath(entry.sport)) },
          { name: entry.eventName, url: routeUrl(path) }
        ]),
        eventData
      ].filter(Boolean)
    });
  });

  return pages;
}


export function getSeoPage(runtime, pathname) {
  const route = parseRoute(pathname);
  const entry = route.name === 'session' ? runtime.scheduleEntries.find(item => item.id === route.sessionId || item.aliasIds?.includes(route.sessionId)) : null;
  const sport = route.name === 'sport' ? findSportBySlug(runtime.scheduleEntries, route.sportSlug) : null;
  const path = route.name === 'country' ? `/countries/${route.noc}`
    : sport ? getSportPath(sport)
      : entry ? getSessionPath(entry.id)
        : pathname.replace(/\/+$/, '') || '/';
  return buildSeoPages(runtime, { sessionEntries: entry ? [entry] : [] }).find(page => page.url === routeUrl(path)) || {
    url: routeUrl(path), title: 'Page Not Found | Games28', description: 'Find LA 2028 country dashboards, sports and the competition schedule on Games28.', indexable: false
  };
}

export function seoHeadElements(page) {
  const meta = (key, value, property = false) => ({ tag: 'meta', attributes: { [property ? 'property' : 'name']: key, content: value } });
  return [
    { tag: 'title', content: page.title },
    meta('description', page.description),
    meta('robots', page.indexable === false ? 'noindex,follow' : 'index,follow'),
    { tag: 'link', attributes: { rel: 'canonical', href: page.url } },
    meta('og:title', page.title, true), meta('og:description', page.description, true),
    meta('og:type', 'website', true), meta('og:url', page.url, true), meta('og:image', SOCIAL_IMAGE_URL, true),
    meta('twitter:card', 'summary_large_image'), meta('twitter:title', page.title),
    meta('twitter:description', page.description), meta('twitter:image', SOCIAL_IMAGE_URL),
    ...(page.structuredData || []).map(data => ({ tag: 'script', attributes: { type: 'application/ld+json' }, content: JSON.stringify(data).replace(/</g, '\\u003c') }))
  ];
}

export function applySeoPage(page, doc = document) {
  doc.head.querySelectorAll('title,meta[name="description"],meta[name="robots"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],script[type="application/ld+json"]').forEach(node => node.remove());
  for (const { tag, attributes = {}, content } of seoHeadElements(page)) {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (content !== undefined) node.textContent = content;
    doc.head.appendChild(node);
  }
}
