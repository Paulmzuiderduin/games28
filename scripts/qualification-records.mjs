const SOURCE_TIERS = new Set(['ioc', 'if', 'noc', 'national_federation']);
const SUBJECT_TYPES = new Set(['noc_quota', 'team_quota', 'athlete', 'team']);
const RECORD_STATES = new Set(['earned', 'allocated', 'selected', 'entered', 'withdrawn', 'replaced']);
const ACTIVE_STATES = new Set(['earned', 'allocated', 'selected', 'entered']);
const REVIEW_RESOLUTIONS = new Set(['pending', 'approved', 'rejected']);
const STATE_PRECEDENCE = { allocated: 1, earned: 2, selected: 3, entered: 4 };

function asNonEmptyString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function asStringArray(value) {
  return Array.isArray(value) ? [...new Set(value.map(asNonEmptyString).filter(Boolean))] : [];
}

function parseDate(value) {
  const text = asNonEmptyString(value);
  return text && Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : null;
}

function sourceHosts(sourceDefinition) {
  return [sourceDefinition?.url, sourceDefinition?.rulesUrl, sourceDefinition?.allocationUrl, sourceDefinition?.entryUrl]
    .filter(Boolean)
    .map((url) => new URL(url).hostname.replace(/^www\./, '').toLowerCase());
}

function hasTrustedSourceUrl(sourceUrl, sourceDefinition) {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
    return sourceHosts(sourceDefinition).includes(host);
  } catch {
    return false;
  }
}

function normalizeRawRecord(raw, index, sourceById) {
  const sourceDefinition = sourceById.get(raw.sourceId);
  const subjectType = asNonEmptyString(raw.subjectType);
  const state = asNonEmptyString(raw.state);
  const sourceTier = asNonEmptyString(raw.sourceTier || sourceDefinition?.sourceTier);
  const sourceUrl = asNonEmptyString(raw.sourceUrl || sourceDefinition?.allocationUrl || sourceDefinition?.url);
  const quotaCount = Number(raw.quotaCount);
  const teamSizeMax = Number(raw.teamSizeMax);
  const record = {
    id: asNonEmptyString(raw.id), noc: asNonEmptyString(raw.noc), sport: asNonEmptyString(raw.sport || sourceDefinition?.sport),
    disciplines: asStringArray(raw.disciplines), events: asStringArray(raw.events), scheduleHints: asStringArray(raw.scheduleHints),
    subjectType, state, athleteName: asNonEmptyString(raw.athleteName), teamName: asNonEmptyString(raw.teamName),
    quotaCount: Number.isInteger(quotaCount) && quotaCount > 0 ? quotaCount : null,
    teamSizeMax: Number.isInteger(teamSizeMax) && teamSizeMax > 0 ? teamSizeMax : null,
    qualificationRoute: asNonEmptyString(raw.qualificationRoute), sourceId: asNonEmptyString(raw.sourceId), sourceTier, sourceUrl,
    sourcePublishedAt: parseDate(raw.sourcePublishedAt), verifiedAt: parseDate(raw.verifiedAt), profileUrl: asNonEmptyString(raw.profileUrl),
    notes: asNonEmptyString(raw.notes), allocationRecordId: asNonEmptyString(raw.allocationRecordId),
    supersedesId: asNonEmptyString(raw.supersedesId), recordKey: asNonEmptyString(raw.recordKey),
    sourceRecordType: asNonEmptyString(raw.sourceRecordType || 'structured_allocation')
  };
  const problems = [];
  if (!record.id || !record.noc || !record.sport) problems.push('missing id, noc, or sport');
  if (!SUBJECT_TYPES.has(record.subjectType)) problems.push('invalid subjectType');
  if (!RECORD_STATES.has(record.state)) problems.push('invalid state');
  if (!SOURCE_TIERS.has(record.sourceTier)) problems.push('source tier is not trusted');
  if (!/^https:\/\//.test(record.sourceUrl || '')) problems.push('missing HTTPS source URL');
  if (!record.sourcePublishedAt || !record.verifiedAt) problems.push('missing sourcePublishedAt or verifiedAt');
  if (record.subjectType === 'athlete' && !record.athleteName) problems.push('athlete record missing athleteName');
  if (record.subjectType === 'team' && !record.teamName) problems.push('team record missing teamName');
  if (['noc_quota', 'team_quota'].includes(record.subjectType) && !record.quotaCount && ACTIVE_STATES.has(record.state)) problems.push('quota record missing quotaCount');
  if (!sourceDefinition || !SOURCE_TIERS.has(sourceDefinition.sourceTier)) problems.push('sourceId does not resolve to a trusted source');
  if (sourceDefinition && !hasTrustedSourceUrl(record.sourceUrl, sourceDefinition)) problems.push('source URL does not match the trusted official source');
  return { record, problems, fallbackId: `row-${index + 1}` };
}

function defaultRecordKey(record) {
  const subject = record.subjectType === 'athlete' ? record.athleteName : record.subjectType === 'team' ? record.teamName : record.disciplines.join('|') || record.events.join('|') || 'all';
  return [record.noc, record.sport, record.subjectType, subject].map((value) => String(value || '').toLowerCase()).join('::');
}

export function normalizeQualificationRecords(rawRecords, sources) {
  const sourceById = new Map((sources || []).map((entry) => [entry.id, entry]));
  const records = [];
  const rejected = [];
  const ids = new Set();
  (rawRecords || []).forEach((raw, index) => {
    const { record, problems, fallbackId } = normalizeRawRecord(raw, index, sourceById);
    if (ids.has(record.id)) problems.push('duplicate qualification record id');
    if (problems.length) { rejected.push({ id: record.id || fallbackId, problems }); return; }
    ids.add(record.id);
    records.push({ ...record, recordKey: record.recordKey || defaultRecordKey(record) });
  });
  return { records, rejected };
}

export function normalizeReviewQueue(entries, sources) {
  const queue = [];
  const approvedRawRecords = [];
  const rejected = [];
  (entries || []).forEach((entry, index) => {
    const id = asNonEmptyString(entry.id) || `review-${index + 1}`;
    const resolution = asNonEmptyString(entry.resolution) || 'pending';
    const detectedAt = parseDate(entry.detectedAt);
    const sourceUrl = asNonEmptyString(entry.sourceUrl);
    const extractedEvidence = asNonEmptyString(entry.extractedEvidence);
    const reason = asNonEmptyString(entry.reason);
    const problems = [];
    if (!REVIEW_RESOLUTIONS.has(resolution)) problems.push('invalid review resolution');
    if (!detectedAt || !sourceUrl || !extractedEvidence || !reason) problems.push('missing review evidence, date, source, or reason');
    if (resolution === 'approved' && !entry.record) problems.push('approved review requires record');
    if (problems.length) { rejected.push({ id, problems }); return; }
    queue.push({
      id, resolution, detectedAt, sourceUrl, extractedEvidence, reason,
      record: entry.record || null,
      suggestedRecord: entry.suggestedRecord || entry.suggested_record || null
    });
    if (resolution === 'approved') approvedRawRecords.push(entry.record);
  });
  const approved = normalizeQualificationRecords(approvedRawRecords, sources);
  return { queue, approvedRecords: approved.records, rejected: [...rejected, ...approved.rejected] };
}

export function resolveActiveQualificationRecords(records) {
  const supersededIds = new Set(records.map((record) => record.supersedesId).filter(Boolean));
  const winnersByKey = new Map();
  records.filter((record) => ACTIVE_STATES.has(record.state) && !supersededIds.has(record.id)).forEach((record) => {
    const previous = winnersByKey.get(record.recordKey);
    if (!previous) { winnersByKey.set(record.recordKey, record); return; }
    const delta = (STATE_PRECEDENCE[record.state] || 0) - (STATE_PRECEDENCE[previous.state] || 0);
    if (delta > 0 || (delta === 0 && record.verifiedAt > previous.verifiedAt)) winnersByKey.set(record.recordKey, record);
  });
  return [...winnersByKey.values()].sort((left, right) => left.noc.localeCompare(right.noc) || left.sport.localeCompare(right.sport));
}

export function buildQualificationPipeline(source, sources) {
  const direct = normalizeQualificationRecords([...(source?.structuredRecords || []), ...(source?.records || [])], sources);
  const review = normalizeReviewQueue(source?.reviewQueue, sources);
  const history = [...direct.records, ...review.approvedRecords];
  return { activeRecords: resolveActiveQualificationRecords(history), history, reviewQueue: review.queue, rejected: [...direct.rejected, ...review.rejected] };
}

export function toQualificationCards(records) {
  return records.map((record) => ({
    id: record.id, noc: record.noc,
    name: record.subjectType === 'athlete'
      ? record.athleteName
      : record.subjectType === 'team'
        ? record.teamName
        : `${record.quotaCount} ${record.subjectType === 'team_quota' ? 'team' : 'individual'} ${record.quotaCount === 1 ? 'quota place' : 'quota places'}`,
    sport: record.sport, disciplines: record.disciplines, scheduleHints: record.scheduleHints.length ? record.scheduleHints : record.events,
    status: ['noc_quota', 'team_quota'].includes(record.subjectType) ? 'quota' : 'named', teamType: ['team', 'team_quota'].includes(record.subjectType) ? 'team' : 'individual',
    subjectType: record.subjectType, state: record.state, quotaCount: record.quotaCount, teamSizeMax: record.teamSizeMax, qualificationRoute: record.qualificationRoute,
    sourceId: record.sourceId, sourceTier: record.sourceTier, sourcePublishedAt: record.sourcePublishedAt, verifiedAt: record.verifiedAt,
    allocationRecordId: record.allocationRecordId,
    lastUpdatedAt: record.verifiedAt, sourceUrl: record.sourceUrl, profileUrl: record.profileUrl, notes: record.notes
  }));
}
