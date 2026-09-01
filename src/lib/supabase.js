import { createClient } from '@supabase/supabase-js';

// These are public browser credentials. RLS protects the private review data;
// a service-role key is deliberately never bundled into the app.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gavpllldsyepqhldczud.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_QYUoV9ivgFR8e8HqYcznLA_r0XvnGbP';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

export async function requestAdminMagicLink(email) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/admin`
    }
  });
  if (error) throw error;
}

export async function getAdminSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getReviewCandidates() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('qualification_review_candidates')
    .select('*')
    .order('detected_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function submitCommunityReport(report) {
  if (!supabase) throw new Error('Reporting is not available right now.');
  const { error } = await supabase.from('community_reports').insert({
    category: report.category,
    noc: report.noc || null,
    sport: report.sport || null,
    source_url: report.sourceUrl || null,
    details: report.details.trim(),
    reporter_email: report.reporterEmail.trim() || null,
    website: report.website || ''
  });
  if (error) throw error;
}

export async function getCommunityReports() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('community_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function resolveCommunityReport({ id, status, resolutionNote }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const session = await getAdminSession();
  const { error } = await supabase.from('community_reports').update({
    status,
    resolution_note: resolutionNote || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: session?.user?.id || null
  }).eq('id', id);
  if (error) throw error;
}

export async function createReviewCandidateFromCommunityReport({ report, source, suggestedRecord }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const id = `visitor-report-${report.id}`;
  const candidate = {
    id,
    source_id: source.id,
    source_url: source.allocationUrl || source.url,
    extracted_evidence: report.details,
    reason: 'Visitor-submitted report. Verify the selected official source before publishing.',
    detected_at: report.created_at,
    suggested_record: suggestedRecord
  };
  const { error: candidateError } = await supabase.from('qualification_review_candidates').insert(candidate);
  if (candidateError) throw candidateError;

  const session = await getAdminSession();
  const { error: reportError } = await supabase.from('community_reports').update({
    status: 'converted',
    converted_candidate_id: id,
    reviewed_at: new Date().toISOString(),
    reviewed_by: session?.user?.id || null
  }).eq('id', report.id);
  if (reportError) throw reportError;
  return id;
}

export async function resolveReviewCandidate({ id, status, confirmationRecord, resolutionNote }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const isFinalDecision = status === 'approved' || status === 'rejected';
  const payload = {
    status,
    confirmation_record: confirmationRecord,
    resolution_note: status === 'pending' ? null : resolutionNote || null,
    resolved_at: isFinalDecision ? new Date().toISOString() : null,
    resolved_by: status === 'pending' ? null : (await getAdminSession())?.user?.id || null,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('qualification_review_candidates').update(payload).eq('id', id);
  if (error) throw error;
}

export async function signOutAdmin() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
