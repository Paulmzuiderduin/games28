import { fileURLToPath } from 'node:url';
import { fetchRestIdPages } from '../src/lib/pagination.js';

function serviceHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json'
  };
}

export function parseCandidateIds(value) {
  return [...new Set(String(value || '')
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean))];
}

async function responseError(action, response) {
  return new Error(`${action}: ${response.status} ${await response.text()}`);
}

export async function approveReviewCandidates({
  candidateIds,
  supabaseUrl,
  serviceRoleKey,
  resolutionNote = 'Approved by the repository owner through a manually dispatched GitHub Action.',
  fetchImpl = fetch,
  now = () => new Date().toISOString()
}) {
  if (!candidateIds.length) throw new Error('At least one review candidate ID is required.');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/qualification_review_candidates`;
  const rows = await fetchRestIdPages(`${endpoint}?select=id,status,suggested_record,confirmation_record`, {
    headers: serviceHeaders(serviceRoleKey),
    fetchImpl
  });
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const missingIds = candidateIds.filter((id) => !rowsById.has(id));
  if (missingIds.length) throw new Error(`Review candidates not found: ${missingIds.join(', ')}`);

  const invalidIds = candidateIds.filter((id) => {
    const row = rowsById.get(id);
    return row.status !== 'approved' && (!row.suggested_record || typeof row.suggested_record !== 'object');
  });
  if (invalidIds.length) throw new Error(`Review candidates have no proposed record: ${invalidIds.join(', ')}`);

  let approvedCount = 0;
  let alreadyApprovedCount = 0;
  for (const id of candidateIds) {
    const row = rowsById.get(id);
    if (row.status === 'approved' && row.confirmation_record) {
      alreadyApprovedCount += 1;
      continue;
    }

    const timestamp = now();
    const response = await fetchImpl(`${endpoint}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...serviceHeaders(serviceRoleKey), prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'approved',
        confirmation_record: row.suggested_record,
        resolution_note: resolutionNote,
        resolved_at: timestamp,
        resolved_by: null,
        updated_at: timestamp
      })
    });
    if (!response.ok) throw await responseError(`Unable to approve ${id}`, response);
    approvedCount += 1;
  }

  const verificationRows = await fetchRestIdPages(`${endpoint}?select=id,status,confirmation_record`, {
    headers: serviceHeaders(serviceRoleKey),
    fetchImpl
  });
  const verifiedById = new Map(verificationRows.map((row) => [row.id, row]));
  const unverifiedIds = candidateIds.filter((id) => {
    const row = verifiedById.get(id);
    return row?.status !== 'approved' || !row.confirmation_record;
  });
  if (unverifiedIds.length) throw new Error(`Approval verification failed for: ${unverifiedIds.join(', ')}`);

  return { approvedCount, alreadyApprovedCount, verifiedCount: candidateIds.length };
}

async function main() {
  const candidateIds = parseCandidateIds(process.env.REVIEW_CANDIDATE_IDS);
  const result = await approveReviewCandidates({
    candidateIds,
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    resolutionNote: process.env.REVIEW_RESOLUTION_NOTE
  });
  console.log(`Review approvals: ${result.approvedCount} approved, ${result.alreadyApprovedCount} already approved, ${result.verifiedCount} verified.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
