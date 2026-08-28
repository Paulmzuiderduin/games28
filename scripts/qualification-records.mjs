const SOURCE_TIERS = new Set(['ioc', 'if', 'noc', 'national_federation']);
const SUBJECT_TYPES = new Set(['noc_quota', 'athlete', 'team']);
const RECORD_STATES = new Set(['earned', 'allocated', 'selected', 'entered', 'withdrawn', 'replaced']);
const PUBLISHABLE_STATES = new Set(['earned', 'allocated', 'selected', 'entered']);

function asNonEmptyString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function asStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(asNonEmptyString).filter(Boolean))]
    : [];
}

function parseDate(value) {
  const text = asNonEmptyString(value);
  return text && Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : null;
}

function isTrustedSource(source) {
  return source && SOURCE_TIERS.has(source.sourceTier) && /^https:\/\//.test(source.url || '');
}

export function normalizeQualificationRecords(source) {
  const sourceById = new Map((source?.sources || []).map((entry) => [entry.id, entry]));
  const rejected = [];
  const accepted = [];

  (source?.records || []).forEach((raw, index) => {
    const sourceDefinition = sourceById.get(raw.sourceId);
    const subjectType = asNonEmptyString(raw.subjectType);
    const state = asNonEmptyString(raw.state);
    const sourceTier = asNonEmptyString(raw.sourceTier || sourceDefinition?.sourceTier);
    const sourceUrl = asNonEmptyString(raw.sourceUrl || sourceDefinition?.url);
    const sourcePublishedAt = parseDate(raw.sourcePublishedAt);
    const verifiedAt = parseDate(raw.verifiedAt);
    const quotaCount = Number(raw.quotaCount);
    const record = {
      id: asNonEmptyString(raw.id),
      noc: asNonEmptyString(raw.noc),
      sport: asNonEmptyString(raw.sport || sourceDefinition?.sport),
      disciplines: asStringArray(raw.disciplines),
      events: asStringArray(raw.events),
      scheduleHints: asStringArray(raw.scheduleHints),
      subjectType,
      state,
      athleteName: asNonEmptyString(raw.athleteName),
      teamName: asNonEmptyString(raw.teamName),
      quotaCount: Number.isInteger(quotaCount) && quotaCount > 0 ? quotaCount : null,
      qualificationRoute: asNonEmptyString(raw.qualificationRoute),
      sourceId: asNonEmptyString(raw.sourceId),
      sourceTier,
      sourceUrl,
      sourcePublishedAt,
      verifiedAt,
      profileUrl: asNonEmptyString(raw.profileUrl),
      notes: asNonEmptyString(raw.notes)
    };

    const problems = [];
    if (!record.id || !record.noc || !record.sport) problems.push('missing id, noc, or sport');
    if (!SUBJECT_TYPES.has(record.subjectType)) problems.push('invalid subjectType');
    if (!RECORD_STATES.has(record.state)) problems.push('invalid state');
    if (!PUBLISHABLE_STATES.has(record.state)) problems.push('state is not publishable');
    if (!SOURCE_TIERS.has(record.sourceTier)) problems.push('source tier is not trusted');
    if (!/^https:\/\//.test(record.sourceUrl || '')) problems.push('missing HTTPS source URL');
    if (!record.sourcePublishedAt || !record.verifiedAt) problems.push('missing sourcePublishedAt or verifiedAt');
    if (record.subjectType === 'athlete' && !record.athleteName) problems.push('athlete record missing athleteName');
    if (record.subjectType === 'team' && !record.teamName) problems.push('team record missing teamName');
    if (record.subjectType === 'noc_quota' && !record.quotaCount) problems.push('quota record missing quotaCount');
    if (record.sourceId && !isTrustedSource(sourceDefinition)) problems.push('sourceId does not resolve to a trusted source');

    if (problems.length) {
      rejected.push({ id: record.id || `row-${index + 1}`, problems });
      return;
    }

    accepted.push(record);
  });

  const ids = new Set();
  const records = accepted.filter((record) => {
    if (ids.has(record.id)) {
      rejected.push({ id: record.id, problems: ['duplicate qualification record id'] });
      return false;
    }
    ids.add(record.id);
    return true;
  });

  return { records, rejected };
}

export function toQualificationCards(records) {
  return records.map((record) => ({
    id: record.id,
    noc: record.noc,
    name: record.subjectType === 'athlete'
      ? record.athleteName
      : record.subjectType === 'team'
        ? record.teamName
        : `${record.quotaCount} ${record.quotaCount === 1 ? 'quota place' : 'quota places'}`,
    sport: record.sport,
    disciplines: record.disciplines,
    scheduleHints: record.scheduleHints.length ? record.scheduleHints : record.events,
    status: record.subjectType === 'noc_quota' ? 'quota' : 'named',
    teamType: record.subjectType === 'team' ? 'team' : 'individual',
    subjectType: record.subjectType,
    state: record.state,
    quotaCount: record.quotaCount,
    qualificationRoute: record.qualificationRoute,
    sourceId: record.sourceId,
    sourceTier: record.sourceTier,
    sourcePublishedAt: record.sourcePublishedAt,
    verifiedAt: record.verifiedAt,
    lastUpdatedAt: record.verifiedAt,
    sourceUrl: record.sourceUrl,
    profileUrl: record.profileUrl,
    notes: record.notes
  }));
}
