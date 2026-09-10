import { annotateQuotaLinks, resolveQuotaSourceLinks } from '../src/lib/quota-links.js';
import { getSportGroup } from '../src/lib/sport-groups.js';

export function buildQuotaGuardSnapshot(runtime) {
  if (!Array.isArray(runtime?.qualificationRecords)) throw new Error('A complete active qualification dataset is required');
  if (!runtime.checkedAt || !Number.isFinite(Date.parse(runtime.checkedAt))) throw new Error('A valid snapshot timestamp is required');
  const records = resolveQuotaSourceLinks(runtime.qualificationRecords, runtime.qualificationHistory);
  const ids = new Set();
  for (const record of records) {
    if (!record.id || ids.has(record.id)) throw new Error('Qualification IDs must be present and unique');
    ids.add(record.id);
  }
  const annotated = annotateQuotaLinks(records);
  // An invalid named selection must not disappear from the capacity calculation.
  // Keep the last server snapshot until its link has been reviewed or corrected.
  if (annotated.some((record) => record.allocationLinkProblem)) {
    throw new Error('Quota snapshot contains unresolved selection links; keep the previous snapshot and review the links.');
  }
  const quotas = annotated.filter((record) => ['noc_quota', 'team_quota'].includes(record.subjectType));
  return {
    checkedAt: runtime.checkedAt,
    quotas: quotas.map((record) => {
      if (!Number.isInteger(record.quotaCount) || record.quotaCount < 1) throw new Error(`Invalid quota capacity: ${record.id}`);
      if (!record.noc || !record.sport) throw new Error(`Quota needs a country and sport: ${record.id}`);
      if (record.quotaLinkProblem) throw new Error(`Quota links need review: ${record.id}`);
      return {
        id: record.id,
        recordKey: record.recordKey || null,
        noc: record.noc,
        sport: getSportGroup(record.sport),
        canonicalEventKey: record.canonicalEventKey || null,
        // Retain ambiguous legacy records but do not let them authorize a link.
        linkable: Boolean(record.canonicalEventKey),
        linkProblem: record.canonicalEventKey ? null : 'Confirm the canonical event before linking a selection.',
        subjectType: record.subjectType,
        quotaCount: record.quotaCount,
        sourcePublishedAt: record.sourcePublishedAt,
        occupants: record.quotaOccupants.map((person) => ({ id: person.id, name: person.name, subjectType: person.subjectType,
          sourcePublishedAt: records.find((item) => item.id === person.id)?.sourcePublishedAt || null }))
      };
    })
  };
}

export async function syncQuotaGuardSnapshot({ runtime, supabaseUrl, serviceRoleKey, fetchImpl = fetch }) {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Quota guard sync requires server credentials');
  const snapshot = buildQuotaGuardSnapshot(runtime);
  const response = await fetchImpl(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/sync_games28_quota_snapshot`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_snapshot: snapshot }),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) {
    // Log only a validated database/API error code, never private record details.
    const error = await response.json().catch(() => null);
    const code = /^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(error?.code || '') ? `; code ${error.code}` : '';
    throw new Error(`Quota guard snapshot sync failed (${response.status}${code})`);
  }
  const result = await response.json();
  if (!Number.isInteger(result) || result < 0) throw new Error('Invalid quota guard sync response');
  return result;
}
