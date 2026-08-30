import { createHash } from 'node:crypto';

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const HEADER_ALIASES = {
  noc: ['noc', 'country code', 'nation code', 'national olympic committee'],
  countryName: ['country', 'nation', 'noc name'],
  athleteName: ['athlete', 'athlete name', 'competitor', 'name'],
  teamName: ['team', 'team name'],
  quotaCount: ['quota', 'quota places', 'places', 'slots', 'athletes'],
  state: ['state', 'status', 'confirmation status'],
  sourcePublishedAt: ['date', 'published', 'published at', 'allocation date', 'qualification date'],
  discipline: ['discipline', 'event'],
  qualificationRoute: ['qualification route', 'route', 'qualification method']
};

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function key(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function stripHtml(value) {
  return text(String(value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' '));
}

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { cells.push(text(cell)); cell = ''; continue; }
    cell += char;
  }
  cells.push(text(cell));
  return cells;
}

function rowsFromCsv(body) {
  const lines = String(body || '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
  });
}

function rowsFromHtml(body) {
  const tables = String(body || '').match(/<table\b[\s\S]*?<\/table>/gi) || [];
  return tables.flatMap((table) => {
    const rows = table.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    if (rows.length < 2) return [];
    const matrix = rows.map((row) => (row.match(/<t[hd]\b[\s\S]*?<\/t[hd]>/gi) || []).map(stripHtml));
    const headers = matrix[0];
    return matrix.slice(1)
      .filter((cells) => cells.length === headers.length)
      .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]])));
  });
}

function rowsFromJson(body) {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) return parsed.filter((entry) => entry && typeof entry === 'object');
    for (const candidate of [parsed.records, parsed.data, parsed.results, parsed.items]) {
      if (Array.isArray(candidate)) return candidate.filter((entry) => entry && typeof entry === 'object');
    }
  } catch {
    // Unparseable JSON is treated as an unsupported structured source.
  }
  return [];
}

function findValue(row, aliases) {
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const matchingKey = rowKeys.find((rowKey) => key(rowKey) === alias);
    if (matchingKey && text(row[matchingKey])) return text(row[matchingKey]);
  }
  return null;
}

function normalizeState(value, subjectType) {
  const normalized = key(value);
  if (['allocated', 'allocation', 'qualified quota'].includes(normalized)) return 'allocated';
  if (['earned', 'qualified'].includes(normalized)) return subjectType === 'noc_quota' ? 'allocated' : 'earned';
  if (['selected', 'selection', 'nominated'].includes(normalized)) return 'selected';
  if (['entered', 'final entry', 'final entries'].includes(normalized)) return 'entered';
  return null;
}

function isIsoDate(value) {
  return Boolean(value) && Number.isFinite(Date.parse(value));
}

function recordFromRow(row, source, knownNocs, nocByCountryName, checkedAt, index) {
  const explicitNoc = findValue(row, HEADER_ALIASES.noc)?.toUpperCase();
  const countryName = findValue(row, HEADER_ALIASES.countryName);
  const noc = explicitNoc || nocByCountryName.get(key(countryName));
  const athleteName = findValue(row, HEADER_ALIASES.athleteName);
  const teamName = findValue(row, HEADER_ALIASES.teamName);
  const quotaCount = Number(findValue(row, HEADER_ALIASES.quotaCount));
  const subjectType = athleteName ? 'athlete' : teamName ? 'team' : Number.isInteger(quotaCount) && quotaCount > 0 ? 'noc_quota' : null;
  const sourcePublishedAt = findValue(row, HEADER_ALIASES.sourcePublishedAt);
  const state = normalizeState(findValue(row, HEADER_ALIASES.state), subjectType);

  if (!noc || !knownNocs.has(noc) || !subjectType || !state || !isIsoDate(sourcePublishedAt)) return null;
  return {
    id: `auto-${source.id}-${hash(JSON.stringify(row))}-${index + 1}`,
    noc,
    sport: source.sport,
    disciplines: [findValue(row, HEADER_ALIASES.discipline)].filter(Boolean),
    subjectType,
    state,
    athleteName,
    teamName,
    quotaCount: subjectType === 'noc_quota' ? quotaCount : null,
    qualificationRoute: findValue(row, HEADER_ALIASES.qualificationRoute),
    sourceId: source.id,
    sourceUrl: source.url,
    sourcePublishedAt: new Date(sourcePublishedAt).toISOString(),
    verifiedAt: checkedAt,
    sourceRecordType: 'structured_allocation'
  };
}

function detectRows(body, contentType) {
  if (/json/i.test(contentType)) return rowsFromJson(body);
  if (/csv|text\/plain/i.test(contentType)) return rowsFromCsv(body);
  if (/html/i.test(contentType) || /<table\b/i.test(body)) return rowsFromHtml(body);
  return [];
}

async function fetchSource(source, fetchImpl) {
  const response = await fetchImpl(source.url, {
    headers: { 'user-agent': 'games28-data-bot/0.4', accept: 'application/json,text/csv,text/html,application/pdf;q=0.9,*/*;q=0.1' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  });
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  return {
    available: response.ok,
    httpStatus: response.status,
    resolvedUrl: response.url || source.url,
    contentType,
    body: body.slice(0, MAX_SOURCE_BYTES),
    truncated: body.length > MAX_SOURCE_BYTES
  };
}

function reviewCandidate(source, body, checkedAt) {
  if (source.status !== 'review_required') return null;
  const evidence = stripHtml(body).slice(0, 600);
  if (!/qualif|selection|selected|allocated|entry/i.test(evidence)) return null;
  return {
    id: `review-${source.id}-${hash(evidence)}`,
    sourceId: source.id,
    resolution: 'pending',
    detectedAt: checkedAt,
    sourceUrl: source.url,
    extractedEvidence: evidence,
    reason: 'Official prose announcement detected; human approval is required before publication.'
  };
}

export async function ingestQualificationSources({ sources, countries, checkedAt, fetchImpl = fetch }) {
  const knownNocs = new Set(countries.map((country) => country.noc));
  const nocByCountryName = new Map(countries.map((country) => [key(country.name), country.noc]));
  const results = await Promise.all(sources.map(async (source) => {
    try {
      const result = await fetchSource(source, fetchImpl);
      const rows = result.available ? detectRows(result.body, result.contentType) : [];
      const records = rows.map((row, index) => recordFromRow(row, source, knownNocs, nocByCountryName, checkedAt, index)).filter(Boolean);
      const candidate = result.available ? reviewCandidate(source, result.body, checkedAt) : null;
      return {
        sourceCheck: { ...source, checkedAt, available: result.available, httpStatus: result.httpStatus, resolvedUrl: result.resolvedUrl },
        records,
        reviewCandidate: candidate,
        scan: { sourceId: source.id, checkedAt, format: result.contentType || 'unknown', rowCount: rows.length, structuredRecordCount: records.length, reviewCandidateId: candidate?.id || null, truncated: result.truncated }
      };
    } catch (error) {
      return {
        sourceCheck: { ...source, checkedAt, available: false, httpStatus: null, resolvedUrl: source.url, checkError: error.message },
        records: [],
        reviewCandidate: null,
        scan: { sourceId: source.id, checkedAt, format: 'unavailable', rowCount: 0, structuredRecordCount: 0, reviewCandidateId: null, error: error.message }
      };
    }
  }));

  return {
    sourceChecks: results.map((result) => result.sourceCheck),
    structuredRecords: results.flatMap((result) => result.records),
    reviewQueue: results.map((result) => result.reviewCandidate).filter(Boolean),
    scans: results.map((result) => result.scan)
  };
}
