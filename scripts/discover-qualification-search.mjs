import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimePath = resolve(rootDir, 'src/data/runtime.json');
const artifactPath = resolve(rootDir, 'src/data/qualification-search-discovery.private.json');
const BRAVE_WEB_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';
const ACTIVE_STATES = new Set(['allocated', 'earned', 'selected', 'entered']);
const QUOTA_TYPES = new Set(['noc_quota', 'team_quota']);

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function domain(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(url, expectedHost) {
  const candidate = domain(url);
  return Boolean(candidate && expectedHost && (candidate === expectedHost || candidate.endsWith(`.${expectedHost}`)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function intentFromEvidence(value) {
  const evidence = text(value).toLowerCase();
  if (/\b(selected|selection|named|nominated|nomination|roster|squad|entered)\b/.test(evidence)) return 'selection';
  if (/\b(qualif|quota|berth|allocated|allocation|secured|earn(?:ed|s)?)\b/.test(evidence)) return 'allocation';
  return null;
}

function isDiscoveryEvidence(value) {
  const evidence = text(value).toLowerCase();
  return Boolean(intentFromEvidence(evidence))
    && !/\b(prediction|projected|projection|odds|ranking preview)\b/.test(evidence);
}

function countryNocsInEvidence(value, countries) {
  const normalized = text(value).toLowerCase();
  return countries
    .filter((country) => country?.name && country.name.length > 3)
    .filter((country) => new RegExp(`\\b${escapeRegExp(country.name.toLowerCase())}\\b`).test(normalized))
    .map((country) => country.noc);
}

function targetId(source, event) {
  return `${source.id}:${event?.key || 'all'}`;
}

export function buildSearchTargets(sources) {
  return (sources || [])
    .filter((source) => source?.qualificationSystemKey && domain(source.url))
    .flatMap((source) => {
      const events = source.qualificationEvents?.length ? source.qualificationEvents : [null];
      return events.map((event) => ({
        id: targetId(source, event),
        sourceId: source.id,
        sourceLabel: source.label,
        systemKey: source.qualificationSystemKey,
        sport: source.sport,
        eventKey: event?.key || null,
        eventLabel: event?.label || source.sport,
        canonicalEventKey: event ? `${source.qualificationSystemKey}:${event.key}` : null,
        trustedHost: domain(source.url)
      }));
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function selectDailyTargets(targets, checkedAt, maxQueries) {
  if (!targets.length || maxQueries <= 0) return [];
  const count = Math.min(targets.length, maxQueries);
  const day = Math.floor(new Date(checkedAt).getTime() / 86_400_000);
  const start = ((day % targets.length) + targets.length) % targets.length;
  return Array.from({ length: count }, (_, offset) => targets[(start + offset) % targets.length]);
}

function queryForTarget(target) {
  return `("LA28" OR "Los Angeles 2028") "${target.eventLabel}" qualification site:${target.trustedHost}`;
}

function hasKnownQuota(records, target, noc) {
  if (!target.canonicalEventKey || !noc) return false;
  return (records || []).some((record) => (
    record.noc === noc
    && record.canonicalEventKey === target.canonicalEventKey
    && QUOTA_TYPES.has(record.subjectType)
    && ACTIVE_STATES.has(record.state)
  ));
}

function candidateId(target, noc, intent) {
  return `review-search-${target.sourceId}-${target.eventKey || 'all'}-${noc || 'unassigned'}-${intent}`
    .replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
}

function candidateForResult(target, result, noc, intent, checkedAt) {
  const evidence = text([result.title, result.description].filter(Boolean).join('. ')).slice(0, 1200);
  return {
    id: candidateId(target, noc, intent),
    sourceId: target.sourceId,
    resolution: 'pending',
    detectedAt: checkedAt,
    sourceUrl: result.url,
    extractedEvidence: evidence,
    reason: `Official web discovery found a possible ${intent} for ${target.eventLabel}${noc ? ` (${noc})` : ''}. Verify the exact country, event, and confirmation before publishing.`,
    discovery: {
      provider: 'brave',
      targetId: target.id,
      qualificationSystemKey: target.systemKey,
      canonicalEventKey: target.canonicalEventKey,
      noc: noc || null,
      intent,
      evidenceHash: hash(evidence),
      resultSnippet: evidence
    }
  };
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function qualificationExcerpt(value) {
  const content = text(stripHtml(value));
  const match = /\b(qualif\w*|quota|berth|allocated|allocation|selected|selection|named|nominated|roster|squad|entered)\b/i.exec(content);
  if (!match) return content.slice(0, 1200);
  const start = Math.max(0, content.lastIndexOf('.', match.index) + 1);
  const end = content.indexOf('.', match.index + 700);
  return content.slice(start, end >= 0 ? end + 1 : match.index + 900).trim().slice(0, 1200);
}

async function refreshEvidenceFromOfficialPage(candidate, fetchImpl) {
  try {
    const response = await fetchImpl(candidate.sourceUrl, {
      headers: { 'user-agent': 'games28-data-bot/0.5' },
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) return candidate;
    const excerpt = qualificationExcerpt(await response.text());
    if (!excerpt || !isDiscoveryEvidence(excerpt)) return candidate;
    return {
      ...candidate,
      extractedEvidence: excerpt,
      discovery: { ...candidate.discovery, evidenceHash: hash(excerpt) }
    };
  } catch {
    // A result snippet from a trusted domain remains enough for a review-only
    // lead; the source page is opened and verified in Admin before approval.
    return candidate;
  }
}

export function candidatesFromSearchResults({ target, results, countries, qualificationRecords, checkedAt }) {
  const candidatesById = new Map();
  let suppressedKnownQuotaCount = 0;

  (results || []).forEach((result) => {
    if (!hostMatches(result.url, target.trustedHost)) return;
    const evidence = text([result.title, result.description].filter(Boolean).join(' '));
    if (!isDiscoveryEvidence(evidence)) return;

    const intent = intentFromEvidence(evidence);
    const nocs = countryNocsInEvidence(evidence, countries);
    const scopes = nocs.length ? nocs : [null];
    scopes.forEach((noc) => {
      // A quota is complete once that NOC/event already has an active quota.
      // Selection remains a separate future state and must still be discoverable.
      if (intent === 'allocation' && hasKnownQuota(qualificationRecords, target, noc)) {
        suppressedKnownQuotaCount += 1;
        return;
      }
      const candidate = candidateForResult(target, result, noc, intent, checkedAt);
      if (!candidatesById.has(candidate.id)) candidatesById.set(candidate.id, candidate);
    });
  });

  return { candidates: [...candidatesById.values()], suppressedKnownQuotaCount };
}

export async function discoverQualificationSearch({
  apiKey,
  sources,
  countries,
  qualificationRecords,
  checkedAt,
  maxQueries = 24,
  fetchImpl = fetch
}) {
  const targets = selectDailyTargets(buildSearchTargets(sources), checkedAt, maxQueries);
  if (!apiKey) {
    return {
      enabled: false,
      provider: 'brave',
      checkedAt,
      queryCount: 0,
      candidates: [],
      scans: [],
      message: 'BRAVE_SEARCH_API_KEY is not configured.'
    };
  }

  const candidatesById = new Map();
  const scans = [];
  let remainingPageFetches = 12;
  for (const target of targets) {
    try {
      const url = new URL(BRAVE_WEB_SEARCH_URL);
      url.searchParams.set('q', queryForTarget(target));
      url.searchParams.set('count', '5');
      url.searchParams.set('search_lang', 'en');
      const response = await fetchImpl(url, {
        headers: { 'x-subscription-token': apiKey },
        signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const results = payload.web?.results || [];
      const extracted = candidatesFromSearchResults({ target, results, countries, qualificationRecords, checkedAt });
      for (const rawCandidate of extracted.candidates) {
        const candidate = remainingPageFetches > 0
          ? await refreshEvidenceFromOfficialPage(rawCandidate, fetchImpl)
          : rawCandidate;
        if (remainingPageFetches > 0) remainingPageFetches -= 1;
        // Result ordering is a useful relevance signal; keep the first result
        // for a qualification scope and refresh its evidence if it changes.
        if (!candidatesById.has(candidate.id)) candidatesById.set(candidate.id, candidate);
      }
      scans.push({ targetId: target.id, query: queryForTarget(target), resultCount: results.length, candidateIds: extracted.candidates.map((candidate) => candidate.id), suppressedKnownQuotaCount: extracted.suppressedKnownQuotaCount });
    } catch (error) {
      scans.push({ targetId: target.id, query: queryForTarget(target), resultCount: 0, candidateIds: [], suppressedKnownQuotaCount: 0, error: error.message });
    }
  }

  return {
    enabled: true,
    provider: 'brave',
    checkedAt,
    queryCount: targets.length,
    candidates: [...candidatesById.values()],
    scans
  };
}

async function main() {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    console.log('Skipping qualification web discovery: BRAVE_SEARCH_API_KEY is not configured.');
    return;
  }

  const runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
  const artifact = await discoverQualificationSearch({
    apiKey,
    sources: runtime.meta?.qualificationSources || [],
    countries: runtime.countries || [],
    qualificationRecords: runtime.qualificationHistory || [],
    checkedAt: new Date().toISOString(),
    maxQueries: Number(process.env.BRAVE_SEARCH_MAX_QUERIES) || 24
  });
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
  console.log(`Qualification web discovery: ${artifact.queryCount} searches, ${artifact.candidates.length} review candidates.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
