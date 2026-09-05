import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = resolve(rootDir, 'src/data/qualification-ingestion.json');
const manualReviewPath = resolve(rootDir, 'src/data/qualification-sources.source.json');
const searchDiscoveryPath = resolve(rootDir, 'src/data/qualification-search-discovery.private.json');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json'
  };
}

function toDatabaseCandidate(entry) {
  return {
    id: entry.id,
    source_id: entry.sourceId || entry.source_id || entry.suggestedRecord?.sourceId || entry.suggested_record?.source_id,
    source_url: entry.sourceUrl || entry.source_url,
    extracted_evidence: entry.extractedEvidence || entry.extracted_evidence,
    reason: entry.reason,
    detected_at: entry.detectedAt || entry.detected_at,
    suggested_record: entry.suggestedRecord || entry.suggested_record || null
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function isSearchCandidate(entry) {
  return String(entry?.id || '').startsWith('review-search-');
}

function searchEvidenceChanged(candidate, existing) {
  const next = toDatabaseCandidate(candidate);
  return next.source_url !== existing.source_url
    || next.extracted_evidence !== existing.extracted_evidence
    || next.reason !== existing.reason
    || stableJson(next.suggested_record) !== stableJson(existing.suggested_record);
}

export function mergeReviewCandidates(...candidateLists) {
  const candidatesById = new Map();
  candidateLists.flat().forEach((candidate) => {
    if (candidate?.id && !candidatesById.has(candidate.id)) candidatesById.set(candidate.id, candidate);
  });
  return [...candidatesById.values()];
}

async function responseError(action, response) {
  return new Error(`${action}: ${response.status} ${await response.text()}`);
}

export async function syncReviewCandidates({ candidates, supabaseUrl, serviceRoleKey, fetchImpl = fetch }) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const endpoint = `${baseUrl}/rest/v1/qualification_review_candidates`;
  const existingResponse = await fetchImpl(`${endpoint}?select=id,status,confirmation_record,source_url,extracted_evidence,reason,suggested_record`, {
    headers: headers(serviceRoleKey)
  });
  if (!existingResponse.ok) throw await responseError('Unable to read existing review candidates', existingResponse);

  const existing = await existingResponse.json();
  const existingById = new Map(existing.map((candidate) => [candidate.id, candidate]));
  const newCandidates = candidates.filter((candidate) => !existingById.has(candidate.id));
  const evidenceUpdates = candidates.filter((candidate) => {
    const existingCandidate = existingById.get(candidate.id);
    return isSearchCandidate(candidate)
      && ['pending', 'review_later'].includes(existingCandidate?.status)
      && searchEvidenceChanged(candidate, existingCandidate);
  });

  // Older upserts could reset an approved row to pending. A pending row that
  // retains its confirmation record is unambiguously such a reset: reopening
  // an item in Admin clears that record first.
  const resetApprovals = existing.filter((candidate) => candidate.status === 'pending' && candidate.confirmation_record);
  await Promise.all(resetApprovals.map(async (candidate) => {
    const response = await fetchImpl(`${endpoint}?id=eq.${encodeURIComponent(candidate.id)}`, {
      method: 'PATCH',
      headers: { ...headers(serviceRoleKey), prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'approved' })
    });
    if (!response.ok) throw await responseError('Unable to restore an approved review candidate', response);
  }));

  if (newCandidates.length) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { ...headers(serviceRoleKey), prefer: 'return=minimal' },
      body: JSON.stringify(newCandidates.map(toDatabaseCandidate))
    });
    if (!response.ok) throw await responseError('Unable to insert new review candidates', response);
  }

  await Promise.all(evidenceUpdates.map(async (candidate) => {
    const { id, ...payload } = toDatabaseCandidate(candidate);
    const response = await fetchImpl(`${endpoint}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...headers(serviceRoleKey), prefer: 'return=minimal' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw await responseError('Unable to update changed search evidence', response);
  }));

  return { insertedCount: newCandidates.length, updatedEvidenceCount: evidenceUpdates.length, restoredApprovalCount: resetApprovals.length, existingCount: existing.length };
}

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.log('Skipping private review sync: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.');
    return;
  }

  const [artifact, manualInput, searchDiscovery] = await Promise.all([
    readFile(artifactPath, 'utf8').then(JSON.parse),
    readFile(manualReviewPath, 'utf8').then(JSON.parse),
    readFile(searchDiscoveryPath, 'utf8').then(JSON.parse).catch(() => ({ candidates: [] }))
  ]);
  // Manual, researched candidates are authoritative for their IDs. The
  // ingestion artifact contributes the daily-discovered candidates alongside them.
  const candidates = mergeReviewCandidates(manualInput.reviewQueue || [], artifact.reviewQueue || [], searchDiscovery.candidates || []);
  const result = await syncReviewCandidates({ candidates, supabaseUrl, serviceRoleKey });
  console.log(`Review queue sync: ${result.insertedCount} new, ${result.updatedEvidenceCount} updated, ${result.restoredApprovalCount} restored, ${result.existingCount} already stored.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
