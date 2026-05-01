import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from './dataset-utils.mjs';
import {
  SITE_NAME,
  SOCIAL_IMAGE_URL,
  getSessionPath,
  getSportPath,
  routeUrl,
  selectSeoSessionEntries
} from '../src/lib/seo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const runtimePath = resolve(rootDir, 'src/data/runtime.json');
const templatePath = resolve(distDir, 'index.html');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function compact(value, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function formatDateTime(isoString) {
  if (!isoString) {
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

function metaTags(page) {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const canonical = escapeHtml(page.url);

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${SOCIAL_IMAGE_URL}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${SOCIAL_IMAGE_URL}" />`
  ].join('\n    ');
}

function jsonLdScript(data) {
  return `<script type="application/ld+json">${escapeJson(data)}</script>`;
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

function fallbackHtml(page) {
  const links = (page.links || [])
    .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join('');
  const facts = (page.facts || [])
    .map((fact) => `<li>${escapeHtml(fact)}</li>`)
    .join('');

  return [
    '<main class="seo-fallback">',
    `<p>${escapeHtml(page.eyebrow || SITE_NAME)}</p>`,
    `<h1>${escapeHtml(page.heading || page.title)}</h1>`,
    `<p>${escapeHtml(page.description)}</p>`,
    facts ? `<ul>${facts}</ul>` : '',
    links ? `<nav aria-label="Related Games28 pages"><ul>${links}</ul></nav>` : '',
    '</main>'
  ].join('');
}

function renderPage(template, page) {
  const structuredData = (page.structuredData || []).map(jsonLdScript).join('\n    ');
  const head = `${metaTags(page)}${structuredData ? `\n    ${structuredData}` : ''}`;
  return template
    .replace(/<title>[\s\S]*?<\/title>/, '<!-- SEO_META -->')
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, '')
    .replace(/<meta\s+property="og:[\s\S]*?\/>\s*/g, '')
    .replace(/<meta\s+name="twitter:[\s\S]*?\/>\s*/g, '')
    .replace('<!-- SEO_META -->', head)
    .replace('<div id="root"></div>', `<div id="root">${fallbackHtml(page)}</div>`);
}

async function writeRoute(template, page) {
  const path = new URL(page.url).pathname;
  const filePath = path === '/' ? resolve(distDir, 'index.html') : resolve(distDir, path.slice(1), 'index.html');
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, renderPage(template, page), 'utf8');
}

function buildPages(runtime) {
  const sports = [...new Set(runtime.scheduleEntries.map((entry) => entry.sport).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  const selectedSessions = selectSeoSessionEntries(runtime.scheduleEntries);
  const pages = [
    {
      url: routeUrl('/'),
      title: 'Games28 | LA 2028 Schedule and Country Dashboards',
      description: `Explore ${runtime.meta.scheduleCount || runtime.scheduleEntries.length} LA 2028 sessions across ${sports.length} sports with local-time schedule views, country dashboards, and calendar exports.`,
      heading: 'Games28 LA 2028 schedule and country dashboards',
      facts: [`${runtime.countries.length} countries indexed`, `${sports.length} sports tracked`, 'Times shown in each visitor local timezone'],
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
      url: routeUrl('/changes'),
      title: 'LA 2028 Schedule Changes | Games28',
      description: 'Track Games28 schedule and qualification data changes as the LA 2028 dataset refreshes.',
      heading: 'Recent LA 2028 schedule and qualification changes',
      facts: [`${runtime.changes.length} tracked changes`, `Last checked ${runtime.checkedAt || 'pending'}`],
      links: [{ href: '/schedule', label: 'Browse schedule' }]
    }
  ];

  runtime.countries.forEach((country) => {
    pages.push({
      url: routeUrl(`/countries/${country.noc}`),
      title: `${country.name} LA 2028 Schedule and Dashboard | Games28`,
      description: `Follow ${country.name} at LA 2028 with a country dashboard for schedule matches, qualification tracking, local-time sessions, and calendar export.`,
      heading: `${country.name} LA 2028 schedule dashboard`,
      facts: [`NOC ${country.noc}`, country.continent, 'Qualification cards appear when verified sources are added'],
      links: [
        { href: '/schedule', label: 'Full schedule' },
        { href: '/changes', label: 'Recent changes' }
      ],
      structuredData: [breadcrumbJsonLd([
        { name: 'Games28', url: routeUrl('/') },
        { name: 'Countries', url: routeUrl('/') },
        { name: country.name, url: routeUrl(`/countries/${country.noc}`) }
      ])]
    });
  });

  sports.forEach((sport) => {
    const entries = runtime.scheduleEntries.filter((entry) => entry.sport === sport);
    pages.push({
      url: routeUrl(getSportPath(sport)),
      title: `${sport} LA 2028 Schedule | Games28`,
      description: `Browse the ${sport} LA 2028 schedule with session times, venues, source links, and calendar export.`,
      heading: `${sport} LA 2028 schedule`,
      facts: [`${entries.length} sessions tracked`, `${new Set(entries.map((entry) => entry.venue).filter(Boolean)).size} venues`, 'Times convert to each visitor local timezone'],
      links: entries.slice(0, 8).map((entry) => ({ href: getSessionPath(entry.id), label: compact(`${entry.eventName} ${entry.sessionCode}`) })),
      structuredData: [breadcrumbJsonLd([
        { name: 'Games28', url: routeUrl('/') },
        { name: 'Sports', url: routeUrl('/schedule') },
        { name: sport, url: routeUrl(getSportPath(sport)) }
      ])]
    });
  });

  selectedSessions.forEach((entry) => {
    const path = getSessionPath(entry.id);
    const eventData = entry.startAtUtc && entry.venue ? {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: `${entry.sport}: ${entry.eventName}`,
      startDate: entry.startAtUtc,
      endDate: entry.endAtUtc || undefined,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: entry.venue
      },
      description: compact(`${entry.phase || 'Scheduled session'} for ${entry.sport} at LA 2028. Source data is tracked by Games28.`)
    } : null;

    pages.push({
      url: routeUrl(path),
      title: `${entry.eventName} LA 2028 ${entry.sport} Session | Games28`,
      description: `Session details for ${entry.eventName} in ${entry.sport} at LA 2028, including local-time display, LA reference time, venue, and calendar export.`,
      heading: `${entry.sport}: ${entry.eventName}`,
      facts: [
        `Session ${entry.sessionCode || 'TBD'}`,
        `${entry.venue || 'Venue TBC'}`,
        formatDateTime(entry.startAtUtc)
      ],
      links: [
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

async function main() {
  const [template, runtime] = await Promise.all([
    readFile(templatePath, 'utf8'),
    readJson(runtimePath, null)
  ]);

  if (!runtime) {
    throw new Error('Missing runtime dataset. Run npm run data:update first.');
  }

  const pages = buildPages(runtime);
  await Promise.all(pages.map((page) => writeRoute(template, page)));
  console.log(`Pre-rendered ${pages.length} SEO routes.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
