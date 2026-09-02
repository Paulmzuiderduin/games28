import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCountryRegistry } from './country-registry.mjs';
import {
  asComparableCountMap,
  buildChangeId,
  dayKeyFromDateLabel,
  parseCsv,
  readBuffer,
  readJson,
  readText,
  sha256Hex,
  writeBufferIfChanged,
  writeJsonIfChanged,
  writeTextIfChanged
} from './dataset-utils.mjs';
import { parseOfficialSchedulePdf } from './official-pdf-parser.mjs';
import { buildQualificationPipeline, toQualificationCards } from './qualification-records.mjs';
import { buildQualificationSystemIndex, toQualificationSources } from './qualification-systems.mjs';
import { buildCountrySelectionRegistry, toCountrySelectionSources } from './country-selection-registry.mjs';
import { ingestQualificationSources } from './qualification-ingestion.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const dataDir = resolve(rootDir, 'src/data');

const scheduleSnapshotPath = resolve(dataDir, 'community-schedule.csv');
const officialPageSnapshotPath = resolve(dataDir, 'official-page.html');
const officialPdfSnapshotPath = resolve(dataDir, 'official-schedule-by-event.snapshot.pdf');
const runtimePath = resolve(dataDir, 'runtime.json');
const sourceCheckPath = resolve(dataDir, 'source-check.json');
const qualificationSourcesPath = resolve(dataDir, 'qualification-sources.source.json');
const countrySelectionOverridesPath = resolve(dataDir, 'country-selection-source-overrides.json');
const registrySourcePath = resolve(dataDir, 'noc-registry.source.json');
const isoOverridesPath = resolve(dataDir, 'noc-iso-overrides.json');
const officialCandidatePath = resolve(dataDir, 'schedule-official-candidate.json');
const communityReferencePath = resolve(dataDir, 'schedule-community-reference.json');
const countryRegistryPath = resolve(dataDir, 'countries.registry.json');
const countrySelectionRegistryPath = resolve(dataDir, 'country-selection.registry.json');
const qualificationIngestionPath = resolve(dataDir, 'qualification-ingestion.json');

const OFFICIAL_PAGE_URL = 'https://la28.org/en/games-plan/olympics.html#olympic-competition-schedule';
const COMMUNITY_SCHEDULE_URL = 'https://docs.google.com/spreadsheets/d/1N8y_tcoS54UFA20kW2Sg3E1lGjupyoHC8c0KZ3WCfvs/export?format=csv&gid=1622079921';
const COMMUNITY_REFERENCE_URL = 'https://docs.google.com/spreadsheets/d/1N8y_tcoS54UFA20kW2Sg3E1lGjupyoHC8c0KZ3WCfvs/edit?gid=1622079921#gid=1622079921';
const OFFICIAL_PDF_FALLBACK_URL = 'https://la28.org/content/dam/latwentyeight/competition-schedule-imagery/uploaded-march-16-v-3-0/LA28OlympicGamesCompetitionScheduleByEventV3.0.pdf';
const OFFICIAL_SESSION_PDF_URL = 'https://la28.org/content/dam/latwentyeight/competition-schedule-imagery/uploaded-march-16-v-3-0/LA28OlympicGamesCompetitionScheduleBySessionV3.0.pdf';
const IOC_NOC_LIST_URL = 'https://www.olympics.com/ioc/national-olympic-committees';
const OFFICIAL_PROMOTION_STREAK = 3;

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'games28-data-bot/0.2'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return {
    body: await response.text(),
    headers: Object.fromEntries(response.headers.entries())
  };
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'games28-data-bot/0.2'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return {
    body: Buffer.from(await response.arrayBuffer()),
    headers: Object.fromEntries(response.headers.entries())
  };
}

async function fetchApprovedReviewQueue() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Local builds deliberately do not have the private key. Treat that as an
  // unavailable source, never as proof that the approved queue is empty.
  if (!supabaseUrl || !serviceRoleKey) return { available: false, entries: [] };

  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/qualification_review_candidates?status=eq.approved&select=id,source_id,source_url,extracted_evidence,reason,detected_at,confirmation_record`;
  const response = await fetch(url, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` }
  });
  if (!response.ok) throw new Error(`Unable to fetch approved qualification reviews: ${response.status}`);
  const rows = await response.json();
  return {
    available: true,
    entries: rows
    .filter((row) => row.confirmation_record)
    .map((row) => ({
      id: row.id,
      resolution: 'approved',
      detectedAt: row.detected_at,
      sourceUrl: row.source_url,
      extractedEvidence: row.extracted_evidence,
      reason: row.reason,
      record: row.confirmation_record
    }))
  };
}

export function approvedRecordsFromRuntime(runtime) {
  return (runtime?.qualificationHistory || [])
    .filter((record) => record.sourceRecordType === 'review_approved');
}

export function preserveQualificationSourceHealth(currentChecks, previousSources = []) {
  const previousById = new Map(previousSources.map((source) => [source.id, source]));

  return currentChecks.map((source) => {
    const previous = previousById.get(source.id);
    if (source.available || !previous?.available) {
      return {
        ...source,
        lastSuccessfulAt: source.available ? source.checkedAt : previous?.lastSuccessfulAt || null
      };
    }

    return {
      ...source,
      available: previous.available,
      httpStatus: previous.httpStatus,
      resolvedUrl: previous.resolvedUrl || source.resolvedUrl,
      lastSuccessfulAt: previous.lastSuccessfulAt || previous.checkedAt,
      healthCheckFailedAt: source.checkedAt
    };
  });
}

export function preserveUnavailableIngestion(current, previous = {}) {
  const unavailableSourceIds = new Set(current.sourceChecks.filter((source) => !source.available).map((source) => source.id));
  const previousRecordsById = new Map((previous.structuredRecords || []).map((record) => [record.id, record]));
  const previousReviewsById = new Map((previous.reviewQueue || []).map((entry) => [entry.id, entry]));
  const carriedRecords = (previous.structuredRecords || []).filter((record) => unavailableSourceIds.has(record.sourceId));
  const carriedReviews = (previous.reviewQueue || []).filter((entry) => unavailableSourceIds.has(entry.sourceId));
  const currentRecords = current.structuredRecords.map((record) => {
    const previousRecord = previousRecordsById.get(record.id);
    return previousRecord ? { ...record, verifiedAt: previousRecord.verifiedAt } : record;
  });
  const currentReviews = current.reviewQueue.map((entry) => {
    const previousReview = previousReviewsById.get(entry.id);
    return previousReview ? { ...entry, detectedAt: previousReview.detectedAt } : entry;
  });

  return {
    ...current,
    structuredRecords: [...currentRecords, ...carriedRecords],
    reviewQueue: [...currentReviews, ...carriedReviews]
  };
}

async function fetchTextWithFallback(url, snapshotPath) {
  try {
    const result = await fetchText(url);
    await writeTextIfChanged(snapshotPath, result.body.endsWith('\n') ? result.body : `${result.body}\n`);
    return { ...result, fallbackUsed: false };
  } catch (error) {
    console.warn(`Falling back to snapshot for ${url}`, error.message);
    const snapshot = await readText(snapshotPath, '');
    if (!snapshot) {
      throw error;
    }
    return { body: snapshot, headers: {}, fallbackUsed: true };
  }
}

async function fetchBufferWithFallback(url, snapshotPath) {
  try {
    const result = await fetchBuffer(url);
    await writeBufferIfChanged(snapshotPath, result.body);
    return { ...result, fallbackUsed: false };
  } catch (error) {
    console.warn(`Falling back to snapshot for ${url}`, error.message);
    const snapshot = await readBuffer(snapshotPath, null);
    if (!snapshot) {
      throw error;
    }
    return { body: snapshot, headers: {}, fallbackUsed: true };
  }
}

function extractOfficialPdfUrl(html) {
  const match = html.match(/href="([^"]*LA28OlympicGamesCompetitionScheduleByEventV[^"#?]+\.pdf)"/i);
  if (!match) {
    return OFFICIAL_PDF_FALLBACK_URL;
  }

  if (match[1].startsWith('http')) {
    return match[1];
  }

  return new URL(match[1], 'https://la28.org').toString();
}

function detectSourceVersion(pdfUrl, pdfBytes) {
  const fromUrl = /CompetitionScheduleByEvent(V[\d.]+)/i.exec(pdfUrl)?.[1];
  if (fromUrl) {
    return fromUrl.toUpperCase();
  }

  const text = pdfBytes.toString('latin1');
  const fromBytes = /Version\s+([\d.]+)/i.exec(text)?.[1];
  return fromBytes ? `V${fromBytes}` : 'UNKNOWN';
}

function normalizeCommunityReference(rows, sourceUrl) {
  return rows
    .map((row, index) => ({
      athleteIds: [],
      competitionDay: Number(row['Games Day']) || null,
      dateLabel: row.Date?.trim() || null,
      dayKey: row.Date?.trim() ? dayKeyFromDateLabel(row.Date.trim()) : null,
      description: row.Event?.trim() || '',
      discipline: row.Event?.trim() || row.Sport?.trim() || '',
      endTimeLocal: row['End Time']?.trim() || null,
      endAtUtc: null,
      eventName: row.Event?.trim() || '',
      gamesDay: Number(row['Games Day']) || null,
      id: `${row['Session Code']?.trim() || 'row'}--community--${index}`,
      nocs: [],
      phase: row['Session Type']?.trim() || 'Session',
      sessionCode: row['Session Code']?.trim() || null,
      sourcePdfHash: null,
      sourceUrl,
      sourceVersion: null,
      sport: row.Sport?.trim() || '',
      startTimeLocal: row['Start Time']?.trim() || null,
      startAtUtc: null,
      status: 'scheduled',
      timezone: 'PT',
      venue: row.Venue?.trim() || 'Venue TBC',
      zone: row.Zone?.trim() || ''
    }))
    .filter((entry) => entry.sessionCode && entry.sport && entry.eventName);
}

function validateOfficialCandidate(candidate, communityReference, previousRuntime) {
  const duplicateIds = candidate.length - new Set(candidate.map((entry) => entry.id)).size;
  const missingRequired = candidate.filter((entry) => !entry.sport || !entry.sessionCode || !entry.dateLabel || !entry.eventName).length;
  const invalidTimes = candidate.filter((entry) => entry.startAtUtc && entry.endAtUtc && entry.startAtUtc >= entry.endAtUtc).length;
  const missingVenueRate = candidate.length ? candidate.filter((entry) => !entry.venue || entry.venue === 'Venue TBC').length / candidate.length : 1;
  const communityCount = communityReference.length;
  const countDeltaRatio = communityCount ? Math.abs(candidate.length - communityCount) / communityCount : 1;
  const previousCount = previousRuntime?.meta?.officialCandidateCount || previousRuntime?.scheduleEntries?.length || communityCount;
  const previousDeltaRatio = previousCount ? Math.abs(candidate.length - previousCount) / previousCount : 0;

  const candidateBySportDay = asComparableCountMap(candidate, (entry) => `${entry.sport}::${entry.dayKey || entry.dateLabel || 'unknown'}`);
  const communityBySportDay = asComparableCountMap(communityReference, (entry) => `${entry.sport}::${entry.dayKey || entry.dateLabel || 'unknown'}`);
  let maxBucketDelta = 0;

  new Set([...candidateBySportDay.keys(), ...communityBySportDay.keys()]).forEach((key) => {
    maxBucketDelta = Math.max(maxBucketDelta, Math.abs((candidateBySportDay.get(key) || 0) - (communityBySportDay.get(key) || 0)));
  });

  const issues = [];
  if (candidate.length < 1500) issues.push('candidate row count too low');
  if (duplicateIds > 0) issues.push('duplicate schedule ids detected');
  if (missingRequired > 0) issues.push('required fields missing');
  if (invalidTimes > 0) issues.push('invalid start/end ordering');
  if (missingVenueRate > 0.12) issues.push('venue null rate too high');
  if (countDeltaRatio > 0.25) issues.push('candidate/community row count delta too large');
  if (previousDeltaRatio > 0.3) issues.push('candidate/previous row count delta too large');
  if (maxBucketDelta > 20) issues.push('sport/day bucket delta too large');

  return {
    passed: issues.length === 0,
    issues,
    metrics: {
      candidateCount: candidate.length,
      communityCount,
      countDeltaRatio: Number(countDeltaRatio.toFixed(4)),
      previousCount,
      previousDeltaRatio: Number(previousDeltaRatio.toFixed(4)),
      duplicateIds,
      invalidTimes,
      maxBucketDelta,
      missingRequired,
      missingVenueRate: Number(missingVenueRate.toFixed(4))
    }
  };
}

function choosePublishedSchedule({ validation, candidate, communityReference, previousRuntime, sourceCheck }) {
  const previousMeta = previousRuntime?.meta || {};
  const previousAuthority = previousMeta.scheduleAuthority || null;
  const previousPublished = Array.isArray(previousRuntime?.scheduleEntries) ? previousRuntime.scheduleEntries : [];
  const previousStreak = Number(sourceCheck?.officialShadowSuccessStreak || 0);
  const nextStreak = validation.passed ? previousStreak + 1 : 0;

  if (validation.passed && nextStreak >= OFFICIAL_PROMOTION_STREAK) {
    return {
      publishedSchedule: candidate,
      scheduleAuthority: 'official_pdf',
      officialShadowSuccessStreak: nextStreak,
      promotionAchieved: previousAuthority !== 'official_pdf'
    };
  }

  if (!validation.passed && previousAuthority === 'official_pdf' && previousPublished.length) {
    return {
      publishedSchedule: previousPublished,
      scheduleAuthority: 'stale_official',
      officialShadowSuccessStreak: 0,
      promotionAchieved: false
    };
  }

  return {
    publishedSchedule: communityReference,
    scheduleAuthority: 'community_reference',
    officialShadowSuccessStreak: nextStreak,
    promotionAchieved: false
  };
}

export function detectChanges(previousRuntime, nextRuntime) {
  if (!previousRuntime) {
    return [
      {
        id: buildChangeId(['initial-import', nextRuntime.checkedAt]),
        entityId: 'schedule-import',
        entityType: 'schedule_entry',
        changeType: 'initial-import',
        changedAt: nextRuntime.checkedAt,
        noc: null,
        sourceUrl: nextRuntime.meta.scheduleAuthority === 'official_pdf' ? nextRuntime.meta.officialScheduleUrl : nextRuntime.meta.communityScheduleUrl,
        summary: `Published ${nextRuntime.scheduleEntries.length} schedule rows into Games28.`
      }
    ];
  }

  const changes = [];
  const previousScheduleById = new Map(previousRuntime.scheduleEntries.map((entry) => [entry.id, entry]));

  nextRuntime.scheduleEntries.forEach((entry) => {
    const previous = previousScheduleById.get(entry.id);
    if (!previous) {
      changes.push({
        id: buildChangeId(['schedule-added', entry.id, nextRuntime.checkedAt]),
        entityId: entry.id,
        entityType: 'schedule_entry',
        changeType: 'schedule-added',
        changedAt: nextRuntime.checkedAt,
        noc: null,
        sourceUrl: entry.sourceUrl,
        summary: `Added session ${entry.sessionCode} for ${entry.eventName}.`
      });
      return;
    }

    const timingChanged = previous.startAtUtc !== entry.startAtUtc || previous.endAtUtc !== entry.endAtUtc;
    const venueChanged = previous.venue !== entry.venue;
    const authorityChanged = previous.sourcePdfHash !== entry.sourcePdfHash;

    if (timingChanged || venueChanged || authorityChanged) {
      changes.push({
        id: buildChangeId(['schedule-updated', entry.id, nextRuntime.checkedAt]),
        entityId: entry.id,
        entityType: 'schedule_entry',
        changeType: 'schedule-updated',
        changedAt: nextRuntime.checkedAt,
        noc: null,
        sourceUrl: entry.sourceUrl,
        summary: `Updated ${entry.eventName} (${entry.sessionCode}) timing, venue, or source.`
      });
    }
  });

  const previousCardsById = new Map(previousRuntime.athleteCards.map((card) => [card.id, card]));
  nextRuntime.athleteCards.forEach((card) => {
    const previous = previousCardsById.get(card.id);
    if (!previous) {
      changes.push({
        id: buildChangeId(['qualification-added', card.id, nextRuntime.checkedAt]),
        entityId: card.id,
        entityType: 'athlete_card',
        changeType: card.status === 'quota' ? 'quota-added' : 'named-athlete-added',
        changedAt: card.lastUpdatedAt || nextRuntime.checkedAt,
        noc: card.noc,
        sourceUrl: card.sourceUrl,
        summary: `${card.noc}: ${card.name} is now tracked as ${card.status}.`
      });
      return;
    }

    if (
      previous.lastUpdatedAt !== card.lastUpdatedAt
      || previous.status !== card.status
      || previous.state !== card.state
      || previous.subjectType !== card.subjectType
      || previous.quotaCount !== card.quotaCount
      || previous.name !== card.name
      || previous.sourceUrl !== card.sourceUrl
    ) {
      changes.push({
        id: buildChangeId(['qualification-updated', card.id, nextRuntime.checkedAt]),
        entityId: card.id,
        entityType: 'athlete_card',
        changeType: 'qualification-updated',
        changedAt: card.lastUpdatedAt || nextRuntime.checkedAt,
        noc: card.noc,
        sourceUrl: card.sourceUrl,
        summary: `${card.noc}: ${card.name} is now ${card.state || card.status}.`
      });
    }
  });

  const nextCardIds = new Set(nextRuntime.athleteCards.map((card) => card.id));
  previousRuntime.athleteCards.forEach((card) => {
    if (nextCardIds.has(card.id)) return;
    changes.push({
      id: buildChangeId(['qualification-removed', card.id, nextRuntime.checkedAt]),
      entityId: card.id,
      entityType: 'athlete_card',
      changeType: 'qualification-removed',
      changedAt: nextRuntime.checkedAt,
      noc: card.noc,
      sourceUrl: card.sourceUrl,
      summary: `${card.noc}: ${card.name} is no longer an active qualification record.`
    });
  });

  const merged = [...changes, ...(Array.isArray(previousRuntime.changes) ? previousRuntime.changes : [])];
  const seen = new Set();

  return merged
    .sort((left, right) => String(right.changedAt).localeCompare(String(left.changedAt)))
    .filter((change) => {
      if (seen.has(change.id)) return false;
      seen.add(change.id);
      return true;
    })
    .slice(0, 80);
}

async function main() {
  const checkedAt = new Date().toISOString();
  const [sourceCheck, previousRuntime, qualificationInput, countrySelectionOverrides, previousIngestion, approvedReviewResult] = await Promise.all([
    readJson(sourceCheckPath, {}),
    readJson(runtimePath, null),
    readJson(qualificationSourcesPath, { structuredRecords: [], reviewQueue: [] }),
    readJson(countrySelectionOverridesPath, { sources: [] }),
    readJson(qualificationIngestionPath, { structuredRecords: [], reviewQueue: [] }),
    fetchApprovedReviewQueue()
  ]);

  const officialPage = await fetchTextWithFallback(OFFICIAL_PAGE_URL, officialPageSnapshotPath);
  const officialPdfUrl = extractOfficialPdfUrl(officialPage.body);
  const officialPdf = await fetchBufferWithFallback(officialPdfUrl, officialPdfSnapshotPath);
  const communitySchedule = await fetchTextWithFallback(COMMUNITY_SCHEDULE_URL, scheduleSnapshotPath);

  const sourcePdfHash = sha256Hex(officialPdf.body);
  const sourceVersion = detectSourceVersion(officialPdfUrl, officialPdf.body);
  const countryRegistry = await buildCountryRegistry({ registrySourcePath, isoOverridesPath });
  const countrySelectionRegistry = buildCountrySelectionRegistry(countryRegistry, countrySelectionOverrides);
  const communityReference = normalizeCommunityReference(parseCsv(communitySchedule.body), COMMUNITY_REFERENCE_URL);
  const officialCandidate = await parseOfficialSchedulePdf(officialPdf.body, {
    sourcePdfHash,
    sourcePdfUrl: officialPdfUrl,
    sourceVersion,
    timezoneFallback: 'PT'
  });
  const qualificationSystemIndex = buildQualificationSystemIndex(officialCandidate);
  const qualificationSources = [
    ...toQualificationSources(qualificationSystemIndex.systems),
    ...toCountrySelectionSources(countrySelectionRegistry)
  ];
  if (qualificationSystemIndex.missingSports.length) {
    throw new Error(`Qualification source coverage missing for: ${qualificationSystemIndex.missingSports.join(', ')}`);
  }
  const currentIngestion = await ingestQualificationSources({
    sources: qualificationSources,
    countries: countryRegistry,
    checkedAt
  });
  const ingestion = preserveUnavailableIngestion(currentIngestion, previousIngestion);
  const qualificationSourceChecks = preserveQualificationSourceHealth(
    ingestion.sourceChecks,
    previousRuntime?.meta?.qualificationSources
  );
  const manualReviewQueue = qualificationInput.reviewQueue || [];
  const manualReviewIds = new Set(manualReviewQueue.map((entry) => entry.id).filter(Boolean));
  const approvedReviewQueue = approvedReviewResult.entries;
  const retainedApprovedRecords = approvedReviewResult.available ? [] : approvedRecordsFromRuntime(previousRuntime);
  const qualificationResult = buildQualificationPipeline({
    structuredRecords: [...(qualificationInput.structuredRecords || []), ...ingestion.structuredRecords],
    records: [...(qualificationInput.records || []), ...retainedApprovedRecords],
    reviewQueue: [...manualReviewQueue, ...approvedReviewQueue, ...ingestion.reviewQueue.filter((entry) => !manualReviewIds.has(entry.id))]
  }, qualificationSources);
  const qualificationRecords = qualificationResult.activeRecords;
  const athleteCards = toQualificationCards(qualificationRecords);

  const validation = validateOfficialCandidate(officialCandidate, communityReference, previousRuntime);
  const publication = choosePublishedSchedule({
    validation,
    candidate: officialCandidate,
    communityReference,
    previousRuntime,
    sourceCheck
  });

  const publishedSchedule = publication.publishedSchedule;
  const sports = new Set(publishedSchedule.map((entry) => entry.sport).filter(Boolean));

  const nextRuntime = {
    version: 2,
    generatedAt: checkedAt,
    checkedAt,
    sources: [
      {
        id: 'official-la28-page',
        kind: 'official',
        label: 'Official LA28 schedule hub',
        description: 'Discovery page for the current By Event and By Session PDFs.',
        url: OFFICIAL_PAGE_URL,
        checkedAt,
        fallbackUsed: officialPage.fallbackUsed
      },
      {
        id: 'official-la28-event-pdf',
        kind: 'official',
        label: 'Official LA28 By Event PDF',
        description: 'Primary parser target for official schedule shadow mode.',
        url: officialPdfUrl,
        checkedAt,
        fallbackUsed: officialPdf.fallbackUsed
      },
      {
        id: 'official-la28-session-pdf',
        kind: 'official',
        label: 'Official LA28 By Session PDF',
        description: 'Visual audit reference only; not used for machine parsing.',
        url: OFFICIAL_SESSION_PDF_URL,
        checkedAt,
        fallbackUsed: false
      },
      {
        id: 'community-la28-sheet',
        kind: 'secondary',
        label: 'Community schedule mirror',
        description: 'Structured comparison and fallback source during shadow mode.',
        url: COMMUNITY_REFERENCE_URL,
        checkedAt,
        fallbackUsed: communitySchedule.fallbackUsed
      },
      {
        id: 'ioc-noc-list',
        kind: 'official',
        label: 'IOC NOC list authority',
        description: 'Canonical authority URL for the maintained NOC registry snapshot.',
        url: IOC_NOC_LIST_URL,
        checkedAt,
        fallbackUsed: true
      }
    ],
    countries: countryRegistry,
    countrySelectionRegistry,
    qualificationSystems: qualificationSystemIndex.systems,
    qualificationRecords,
    qualificationHistory: qualificationResult.history,
    qualificationReviewQueue: qualificationResult.reviewQueue,
    athleteCards,
    scheduleEntries: publishedSchedule,
    changes: [],
    meta: {
      communityReferenceCount: communityReference.length,
      communityScheduleUrl: COMMUNITY_REFERENCE_URL,
      countryCount: countryRegistry.length,
      flagPack: 'flag-icons',
      hasSecondaryScheduleSource: true,
      lastChangedAt: checkedAt,
      officialCandidateCount: officialCandidate.length,
      officialEventPdfUrl: officialPdfUrl,
      officialPageUrl: OFFICIAL_PAGE_URL,
      officialPdfHash: sourcePdfHash,
      officialSessionPdfUrl: OFFICIAL_SESSION_PDF_URL,
      officialSourceVersion: sourceVersion,
      officialValidation: validation,
      qualificationCount: athleteCards.length,
      qualificationRecordCount: qualificationRecords.length,
      qualificationHistoryCount: qualificationResult.history.length,
      qualificationRejectedCount: qualificationResult.rejected.length,
      qualificationReviewCount: qualificationResult.reviewQueue.filter((entry) => entry.resolution === 'pending').length,
      qualificationAutoRecordCount: ingestion.structuredRecords.length,
      qualificationSourceScanCount: ingestion.scans.length,
      qualificationPolicy: 'confirmation_only',
      qualificationCoverage: {
        coveredSportCount: qualificationSystemIndex.systems.flatMap((system) => system.coveredSports).length,
        missingSports: qualificationSystemIndex.missingSports,
        systemCount: qualificationSystemIndex.systems.length,
        configuredSystemCount: qualificationSystemIndex.systems.filter((system) => system.status !== 'watching').length
      },
      countrySelectionCoverage: {
        countryCount: countrySelectionRegistry.length,
        configuredCount: countrySelectionRegistry.filter((entry) => entry.status === 'configured').length,
        awaitingEndpointCount: countrySelectionRegistry.filter((entry) => entry.status === 'awaiting_endpoint').length
      },
      qualificationSources: qualificationSourceChecks.map((source) => ({
        id: source.id,
        qualificationSystemKey: source.qualificationSystemKey,
        label: source.label,
        governingBody: source.governingBody,
        sport: source.sport,
        sports: source.sports,
        qualificationEvents: source.qualificationEvents || [],
        sourceTier: source.sourceTier,
        kind: source.kind,
        status: source.status,
        url: source.url,
        rulesUrl: source.rulesUrl,
        allocationUrl: source.allocationUrl,
        entryUrl: source.entryUrl,
        refreshPolicy: source.refreshPolicy,
        checkedAt: source.checkedAt,
        available: source.available,
        httpStatus: source.httpStatus,
        resolvedUrl: source.resolvedUrl
      })),
      refreshCadence: 'Daily',
      scheduleAuthority: publication.scheduleAuthority,
      scheduleCount: publishedSchedule.length,
      shadowMode: true,
      sportCount: sports.size,
      staleWarning: publication.scheduleAuthority === 'stale_official'
        ? 'Official parser validation failed on this refresh, so Games28 is serving the last known good official schedule.'
        : null
    }
  };

  nextRuntime.changes = detectChanges(previousRuntime, nextRuntime);
  nextRuntime.meta.lastChangedAt = nextRuntime.changes[0]?.changedAt || checkedAt;

  const nextSourceCheck = {
    checkedAt,
    officialPageUrl: OFFICIAL_PAGE_URL,
    officialPdfUrl,
    officialPdfHash: sourcePdfHash,
    officialSourceVersion: sourceVersion,
    officialShadowSuccessStreak: publication.officialShadowSuccessStreak,
    officialValidationPassed: validation.passed,
    officialValidationIssues: validation.issues,
    promotionAchieved: publication.promotionAchieved
  };

  await Promise.all([
    writeJsonIfChanged(runtimePath, nextRuntime),
    writeJsonIfChanged(sourceCheckPath, nextSourceCheck),
    writeJsonIfChanged(officialCandidatePath, officialCandidate),
    writeJsonIfChanged(communityReferencePath, communityReference),
    writeJsonIfChanged(countryRegistryPath, countryRegistry),
    writeJsonIfChanged(countrySelectionRegistryPath, countrySelectionRegistry),
    writeJsonIfChanged(qualificationIngestionPath, {
      checkedAt,
      scans: ingestion.scans,
      structuredRecords: ingestion.structuredRecords,
      reviewQueue: ingestion.reviewQueue,
      rejected: qualificationResult.rejected
    })
  ]);

  console.log(`Updated Games28 runtime with ${publishedSchedule.length} published schedule entries (${publication.scheduleAuthority}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
