import { getSportGroup } from './sport-groups.js';
import { qualificationSupersessionLinks } from './qualification-supersession.js';

const quotaTypes = new Set(['noc_quota', 'team_quota']);
const active = record => !['withdrawn', 'replaced'].includes(record.state);
const normalized = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const nameOf = record => record.name || record.athleteName || record.teamName || record.id;

export function resolveQuotaSourceLinks(records, history = records) {
  const byId = new Map(records.map(record => [record.id, record]));
  const historicalById = new Map(history.map(record => [record.id, record]));
  return records.map(record => {
    if (!record.allocationRecordId || byId.has(record.allocationRecordId)) return record;
    const original = historicalById.get(record.allocationRecordId);
    if (!original?.recordKey || !quotaTypes.has(original.subjectType)) return record;
    const matches = records.filter(item => active(item) && item.recordKey === original.recordKey
      && item.noc === original.noc && getSportGroup(item.sport) === getSportGroup(original.sport)
      && item.subjectType === original.subjectType
      && (original.canonicalEventKey || item.canonicalEventKey
        ? original.canonicalEventKey === item.canonicalEventKey
        : (original.disciplines || []).some(value => normalized(value))
          && JSON.stringify([...(original.disciplines || [])].map(normalized).sort()) === JSON.stringify([...(item.disciplines || [])].map(normalized).sort())));
    // Never pick an arbitrary winner if the active identity is ambiguous.
    return matches.length === 1 ? { ...record, allocationRecordId: matches[0].id } : record;
  });
}

export function quotaLinkProblem(record, quota, { requireCanonicalEvent = false } = {}) {
  if (!quota || !quotaTypes.has(quota.subjectType) || !active(quota)) return 'The linked quota is no longer active or could not be found.';
  if (record.noc !== quota.noc || getSportGroup(record.sport) !== getSportGroup(quota.sport)) return 'The quota must belong to the same country and sport.';
  if ((record.subjectType === 'athlete' && quota.subjectType !== 'noc_quota') || (record.subjectType === 'team' && quota.subjectType !== 'team_quota') || !['athlete', 'team'].includes(record.subjectType)) return 'Link an athlete to an individual quota, or a named team/pair to a team quota.';
  if (requireCanonicalEvent && (!record.canonicalEventKey || !quota.canonicalEventKey)) return 'Choose a verified event for both the quota and the selection before linking them. Matching text labels alone are not enough.';
  if (record.canonicalEventKey && quota.canonicalEventKey) {
    if (record.canonicalEventKey !== quota.canonicalEventKey) return 'The quota and selection must be for the same event.';
  } else {
    const events = record => [...new Set((record.disciplines || []).map(normalized).filter(Boolean))].sort();
    const selectedEvents = events(record);
    if (!selectedEvents.length || JSON.stringify(selectedEvents) !== JSON.stringify(events(quota))) return 'Choose the same explicit event for the quota and selection before linking them.';
  }
  if (!Number.isInteger(quota.quotaCount) || quota.quotaCount < 1) return 'The quota capacity is missing.';
  return null;
}

export function annotateQuotaLinks(records) {
  const copies = records.map(record => ({ ...record, allocationLinkProblem: null }));
  const byId = new Map(copies.map(record => [record.id, record]));
  for (const quota of copies.filter(record => quotaTypes.has(record.subjectType))) {
    quota.quotaOccupants = [];
    quota.filledQuotaCount = 0;
    quota.remainingQuotaCount = quota.quotaCount;
    quota.quotaLinkProblem = null;
  }
  for (const record of copies) {
    if (!active(record) || !record.allocationRecordId) continue;
    const quota = byId.get(record.allocationRecordId);
    record.allocationLinkProblem = quotaLinkProblem(record, quota);
    if (!record.allocationLinkProblem) quota.quotaOccupants.push({ id: record.id, name: nameOf(record), sourceUrl: record.sourceUrl, subjectType: record.subjectType });
  }
  for (const quota of copies.filter(record => quotaTypes.has(record.subjectType))) {
    const occupants = [...new Map(quota.quotaOccupants.map(person => [`${person.subjectType}:${normalized(person.name)}`, person])).values()];
    if (occupants.length > quota.quotaCount) {
      quota.quotaLinkProblem = 'Linked selections exceed the quota capacity; review the links.';
      for (const person of quota.quotaOccupants) byId.get(person.id).allocationLinkProblem = quota.quotaLinkProblem;
      quota.quotaOccupants = [];
    } else {
      quota.quotaOccupants = occupants;
      quota.filledQuotaCount = occupants.length;
      quota.remainingQuotaCount = quota.quotaCount - occupants.length;
    }
  }
  return copies;
}

export function reviewQuotaRecords(published, candidates, { includeHistory = false } = {}) {
  const byId = new Map(published.map(record => [record.id, record]));
  for (const candidate of candidates) {
    const id = candidate.confirmation_record?.id || `approved-${candidate.id}`;
    byId.delete(id);
    if (candidate.status === 'approved' && candidate.confirmation_record) {
      const record = candidate.confirmation_record;
      byId.set(id, { ...record, name: record.athleteName || record.teamName || `${record.quotaCount} quota places` });
    }
  }
  if (includeHistory) return [...byId.values()];
  const { supersededIds: superseded } = qualificationSupersessionLinks([...byId.values()]);
  return [...byId.values()].filter(record => active(record) && !superseded.has(record.id));
}

export function validateQuotaSelection(record, existing) {
  if (!record.allocationRecordId) return;
  const problem = quotaLinkProblem(record, existing.find(item => item.id === record.allocationRecordId), { requireCanonicalEvent: true });
  if (problem) throw new Error(problem);
  const history = [...existing.filter(item => item.id !== record.id), record];
  const { supersededIds, problems } = qualificationSupersessionLinks(history);
  if (record.supersedesId) {
    const target = existing.find(item => item.id === record.supersedesId);
    const date = Date.parse(record.sourcePublishedAt);
    const priorDate = Date.parse(target?.sourcePublishedAt);
    if (!target || target.id === record.id || target.allocationRecordId !== record.allocationRecordId
      || !Number.isFinite(date) || !Number.isFinite(priorDate) || date <= priorDate
      || problems.some(item => item.id === record.id)) {
      throw new Error('A replacement needs an existing selection for the same quota and newer official evidence.');
    }
  }
  const combined = history.filter(item => !supersededIds.has(item.id));
  const result = annotateQuotaLinks(combined).find(item => item.id === record.id);
  if (!result) throw new Error('This selection has already been replaced. Review the current selection instead.');
  if (result.allocationLinkProblem) throw new Error(result.allocationLinkProblem);
}
