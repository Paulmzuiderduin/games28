import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = resolve(rootDir, 'src/data/qualification-ingestion.json');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.log('Skipping private review sync: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.');
    return;
  }

  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  const candidates = (artifact.reviewQueue || []).map((entry) => ({
    id: entry.id,
    source_id: entry.sourceId,
    source_url: entry.sourceUrl,
    extracted_evidence: entry.extractedEvidence,
    reason: entry.reason,
    detected_at: entry.detectedAt
  }));

  if (!candidates.length) {
    console.log('No review candidates to sync.');
    return;
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/qualification_review_candidates?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(candidates)
  });

  if (!response.ok) {
    throw new Error(`Supabase review sync failed: ${response.status} ${await response.text()}`);
  }

  console.log(`Synced ${candidates.length} review candidate(s) to Supabase.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
