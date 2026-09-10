export function qualificationSupersessionLinks(records) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const supersededIds = new Set();
  const problems = [];
  const event = (record) => record.canonicalEventKey || [...new Set([...(record.disciplines || []), ...(record.events || [])])].sort().join('|');
  for (const record of records) {
    if (!record.supersedesId) continue;
    const target = byId.get(record.supersedesId);
    const quotaTypes = new Set(['noc_quota', 'team_quota']);
    const words = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    const targetWords = target ? words(event(target)) : [];
    const reviewedQuotaCorrection = target && record.reviewCandidateId && target.reviewCandidateId
      && quotaTypes.has(record.subjectType) && quotaTypes.has(target.subjectType)
      && record.verifiedAt > target.verifiedAt
      && (event(record) === event(target) || (!target.canonicalEventKey && targetWords.length && targetWords.every((word) => words(event(record)).includes(word))));
    let reason = null;
    if (!target) reason = 'superseded record not found';
    else if (!event(record) || record.noc !== target.noc || record.sport !== target.sport || (!reviewedQuotaCorrection && (event(record) !== event(target) || record.subjectType !== target.subjectType))) reason = 'supersession must stay within the same country, sport, event and subject type';
    else if (!reviewedQuotaCorrection && (record.sourcePublishedAt || record.verifiedAt) < (target.sourcePublishedAt || target.verifiedAt)) reason = 'supersession predates the record it replaces';
    const visited = new Set([record.id]);
    let cursor = target;
    while (!reason && cursor) {
      if (visited.has(cursor.id)) { reason = 'cyclic supersession'; break; }
      visited.add(cursor.id);
      cursor = byId.get(cursor.supersedesId);
    }
    if (reason) problems.push({ id: record.id, problems: [reason] });
    else supersededIds.add(target.id);
  }
  return { supersededIds, problems };
}

