const normalized = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function matchingEntries(scheduleEntries, record) {
  if (Array.isArray(record.scheduleEntryIds) && record.scheduleEntryIds.length) {
    const ids = new Set(record.scheduleEntryIds.map((id) => String(id)));
    return scheduleEntries.filter((entry) => ids.has(entry.id));
  }
  if (!record.sessionCode) return [];
  let matches = scheduleEntries.filter((entry) => entry.sessionCode === record.sessionCode);
  if (record.eventName)
    matches = matches.filter((entry) => normalized(entry.eventName) === normalized(record.eventName));
  if (record.discipline)
    matches = matches.filter((entry) => normalized(entry.discipline) === normalized(record.discipline));
  return matches;
}

function validHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * Apply manually verified official draw/entry-list records to the published
 * schedule. Records are intentionally strict: no source, date, country or
 * session match means the refresh fails instead of silently inventing a link.
 */
export function applyEntryLists(scheduleEntries, input, { countries = [] } = {}) {
  const knownNocs = new Set(countries.map((country) => country.noc));
  const entries = Array.isArray(input?.entries) ? input.entries : [];
  const additions = new Map();
  const rejected = [];

  entries.forEach((record, index) => {
    const id = String(record?.id || `entry-list-${index + 1}`);
    const problems = [];
    if (!validHttpsUrl(record?.sourceUrl)) problems.push('sourceUrl must be an HTTPS URL');
    if (!record?.publishedAt || !Number.isFinite(Date.parse(record.publishedAt)))
      problems.push('publishedAt must be a valid date');
    if (!Array.isArray(record?.nocs) || !record.nocs.length) problems.push('at least one NOC is required');
    const nocs = uniqueSorted((record?.nocs || []).map((noc) => String(noc).toUpperCase()));
    const athleteIds = uniqueSorted(
      Array.isArray(record?.athleteIds) ? record.athleteIds.map((athleteId) => String(athleteId)) : []
    );
    const unknownNocs = nocs.filter((noc) => !knownNocs.has(noc));
    if (unknownNocs.length) problems.push(`unknown NOC(s): ${unknownNocs.join(', ')}`);
    const matches = matchingEntries(scheduleEntries, record || {});
    if (!matches.length) problems.push('no matching schedule entry');
    if (Array.isArray(record?.scheduleEntryIds)) {
      const found = new Set(matches.map((entry) => entry.id));
      const missing = record.scheduleEntryIds.filter((entryId) => !found.has(entryId));
      if (missing.length) problems.push(`unknown schedule entry id(s): ${missing.join(', ')}`);
    }
    if (problems.length) {
      rejected.push({ id, problems });
      return;
    }

    matches.forEach((entry) => {
      const addition = additions.get(entry.id) || { nocs: new Set(), athleteIds: new Set() };
      nocs.forEach((noc) => addition.nocs.add(noc));
      athleteIds.forEach((athleteId) => addition.athleteIds.add(athleteId));
      additions.set(entry.id, addition);
    });
  });

  const enriched = scheduleEntries.map((entry) => {
    const addition = additions.get(entry.id);
    if (!addition) return entry;
    return {
      ...entry,
      nocs: uniqueSorted([...(entry.nocs || []), ...addition.nocs]),
      athleteIds: uniqueSorted([...(entry.athleteIds || []), ...addition.athleteIds])
    };
  });

  return {
    scheduleEntries: enriched,
    appliedCount: additions.size,
    rejected
  };
}
