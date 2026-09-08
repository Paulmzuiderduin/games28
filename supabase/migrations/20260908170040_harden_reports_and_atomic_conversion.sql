-- Public submissions can set content only, never moderation, identity or timestamps.
revoke insert on public.community_reports from anon, authenticated;
grant insert (category, noc, sport, source_url, details, reporter_email, website)
  on public.community_reports to anon, authenticated;

create schema if not exists games28_private;
revoke all on schema games28_private from public, anon, authenticated;
create index if not exists community_reports_created_at_idx on public.community_reports (created_at);

-- This trigger needs privileged count access because visitors cannot read reports.
-- It exposes no report content and is not an RPC. A global ceiling bounds anonymous
-- intake; it is a safety limit, not a substitute for a dedicated anti-bot service.
create or replace function games28_private.limit_report_intake()
returns trigger language plpgsql security definer
set search_path = pg_catalog
as $$
begin
  perform pg_advisory_xact_lock(280028, 1);
  if (select count(*) from public.community_reports where created_at >= now() - interval '1 minute') >= 30
    or (select count(*) from public.community_reports where created_at >= now() - interval '1 day') >= 500 then
    raise exception 'Report intake is busy. Please try again later.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function games28_private.limit_report_intake() from public, anon, authenticated;
drop trigger if exists limit_community_report_intake on public.community_reports;
create trigger limit_community_report_intake before insert on public.community_reports
  for each row execute function games28_private.limit_report_intake();

-- The caller retains RLS permissions throughout; only an actual Games28 admin
-- can convert a report. The row lock makes double-clicks/retries idempotent.
create or replace function public.convert_community_report(
  p_report_id uuid,
  p_source_id text,
  p_source_url text,
  p_suggested_record jsonb
) returns text language plpgsql security invoker
set search_path = pg_catalog
as $$
declare
  report public.community_reports%rowtype;
  candidate_id text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.games28_admins where user_id = auth.uid()
  ) then
    raise exception 'Games28 admin access required.' using errcode = '42501';
  end if;
  select * into report from public.community_reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found or access denied.' using errcode = 'P0002';
  end if;
  if report.status = 'converted' and report.converted_candidate_id is not null then
    return report.converted_candidate_id;
  end if;
  if report.category not in ('missing_qualification', 'qualification_correction') then
    raise exception 'Only qualification reports can create qualification candidates.';
  end if;
  if nullif(btrim(p_source_id), '') is null or p_source_url is null
    or p_source_url !~ '^https://[^/[:space:]]+' or char_length(p_source_url) > 4096
    or p_suggested_record is null or jsonb_typeof(p_suggested_record) <> 'object' then
    raise exception 'Choose an official source, HTTPS evidence URL and proposed record.';
  end if;
  candidate_id := 'visitor-report-' || report.id::text;
  insert into public.qualification_review_candidates (
    id, source_id, source_url, extracted_evidence, reason, detected_at, suggested_record
  ) values (
    candidate_id, p_source_id, p_source_url, report.details,
    'Visitor-submitted report. Verify the linked official evidence before publication.',
    report.created_at, p_suggested_record
  ) on conflict (id) do nothing;
  -- Existing legacy half-conversions are linked, never overwritten or reopened.
  update public.community_reports set
    status = 'converted', converted_candidate_id = candidate_id,
    reviewed_at = now(), reviewed_by = auth.uid()
    where id = report.id;
  return candidate_id;
end;
$$;
revoke all on function public.convert_community_report(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.convert_community_report(uuid, text, text, jsonb) to authenticated;
