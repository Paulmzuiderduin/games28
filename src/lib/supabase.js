import { resolveReportEvidenceUrl } from './report-evidence.js';
import { fetchClientIdPages } from './pagination.js';
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
  return fetchClientIdPages(supabase, 'qualification_review_candidates', 'detected_at');
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
  return fetchClientIdPages(supabase, 'community_reports', 'created_at');
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

export async function createReviewCandidateFromCommunityReport({ report, source, suggestedRecord, evidenceUrl }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const sourceUrl = resolveReportEvidenceUrl(report, source, evidenceUrl);
  const { data, error } = await supabase.rpc('convert_community_report', {
    p_report_id: report.id,
    p_source_id: source.id,
    p_source_url: sourceUrl,
    p_suggested_record: { ...suggestedRecord, sourceId: source.id, sourceUrl }
  });
  if (error) throw error;
  return data;
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
  const { data, error } = await supabase.from('qualification_review_candidates')
    .update(payload).eq('id', id).select('id,status').single();
  if (error) throw error;
  if (data?.id !== id || data?.status !== status) throw new Error('The review was not saved. Refresh the queue and try again.');
}

export async function signOutAdmin() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
