import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = resolve(rootDir, 'src/data/qualification-ingestion.json');
const manualReviewPath = resolve(rootDir, 'src/data/qualification-sources.source.json');
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
    source_id: entry.sourceId,
    source_url: entry.sourceUrl,
    extracted_evidence: entry.extractedEvidence,
    reason: entry.reason,
    detected_at: entry.detectedAt,
    suggested_record: entry.suggestedRecord || null
  };
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
  const existingResponse = await fetchImpl(`${endpoint}?select=id,status,confirmation_record`, {
    headers: headers(serviceRoleKey)
  });
  if (!existingResponse.ok) throw await responseError('Unable to read existing review candidates', existingResponse);

  const existing = await existingResponse.json();
  const existingById = new Map(existing.map((candidate) => [candidate.id, candidate]));
  const newCandidates = candidates.filter((candidate) => !existingById.has(candidate.id));

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
      body: JSON.stringify(newCandidates)
    });
    if (!response.ok) throw await responseError('Unable to insert new review candidates', response);
  }

  return { insertedCount: newCandidates.length, restoredApprovalCount: resetApprovals.length, existingCount: existing.length };
}

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.log('Skipping private review sync: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.');
    return;
  }

  const [artifact, manualInput] = await Promise.all([
    readFile(artifactPath, 'utf8').then(JSON.parse),
    readFile(manualReviewPath, 'utf8').then(JSON.parse)
  ]);
  // Manual, researched candidates are authoritative for their IDs. The
  // ingestion artifact contributes the daily-discovered candidates alongside them.
  const candidates = mergeReviewCandidates(manualInput.reviewQueue || [], artifact.reviewQueue || [])
    .map(toDatabaseCandidate);
  const result = await syncReviewCandidates({ candidates, supabaseUrl, serviceRoleKey });
  console.log(`Review queue sync: ${result.insertedCount} new, ${result.restoredApprovalCount} restored, ${result.existingCount} already stored.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
