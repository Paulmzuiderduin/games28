import { getSportGroup } from './sport-groups.js';

const quotaTypes = new Set(['noc_quota', 'team_quota']);
const active = record => !['withdrawn', 'replaced'].includes(record.state);
const normalized = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const nameOf = record => record.name || record.athleteName || record.teamName || record.id;

export function quotaLinkProblem(record, quota) {
  if (!quota || !quotaTypes.has(quota.subjectType) || !active(quota)) return 'The linked quota is no longer active or could not be found.';
  if (record.noc !== quota.noc || getSportGroup(record.sport) !== getSportGroup(quota.sport)) return 'The quota must belong to the same country and sport.';
  if ((record.subjectType === 'athlete' && quota.subjectType !== 'noc_quota') || (record.subjectType === 'team' && quota.subjectType !== 'team_quota') || !['athlete', 'team'].includes(record.subjectType)) return 'Link an athlete to an individual quota, or a named team/pair to a team quota.';
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

export function reviewQuotaRecords(published, candidates) {
  const byId = new Map(published.map(record => [record.id, record]));
  for (const candidate of candidates) {
    const id = candidate.confirmation_record?.id || `approved-${candidate.id}`;
    byId.delete(id);
    if (candidate.status === 'approved' && candidate.confirmation_record) {
      const record = candidate.confirmation_record;
      byId.set(id, { ...record, name: record.athleteName || record.teamName || `${record.quotaCount} quota places` });
    }
  }
  const superseded = new Set([...byId.values()].map(record => record.supersedesId).filter(Boolean));
  return [...byId.values()].filter(record => active(record) && !superseded.has(record.id));
}

export function validateQuotaSelection(record, existing) {
  if (!record.allocationRecordId) return;
  const combined = [...existing.filter(item => item.id !== record.id && item.id !== record.supersedesId), record];
  const result = annotateQuotaLinks(combined).find(item => item.id === record.id);
  if (result.allocationLinkProblem) throw new Error(result.allocationLinkProblem);
}
