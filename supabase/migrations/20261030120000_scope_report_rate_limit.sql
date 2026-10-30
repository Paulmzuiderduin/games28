-- Bound anonymous report intake per client without storing raw IP addresses.
alter table public.community_reports
  add column if not exists request_ip_hash text;

create index if not exists community_reports_request_ip_created_at_idx
  on public.community_reports (request_ip_hash, created_at desc)
  where request_ip_hash is not null;

create or replace function games28_private.limit_report_intake()
returns trigger language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  headers jsonb := '{}'::jsonb;
  client_ip text;
  fingerprint text;
begin
  perform pg_advisory_xact_lock(280028, 1);
  begin
    headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    headers := '{}'::jsonb;
  end;

  client_ip := nullif(split_part(coalesce(headers->>'x-forwarded-for', ''), ',', 1), '');
  if client_ip is null then
    client_ip := nullif(headers->>'cf-connecting-ip', '');
  end if;
  fingerprint := case when client_ip is null then null else md5(client_ip) end;
  new.request_ip_hash := fingerprint;

  if (select count(*) from public.community_reports where created_at >= now() - interval '1 minute') >= 30
    or (select count(*) from public.community_reports where created_at >= now() - interval '1 day') >= 500
    or (fingerprint is not null and (
      select count(*) from public.community_reports
      where request_ip_hash = fingerprint and created_at >= now() - interval '1 hour'
    ) >= 10) then
    raise exception 'Report intake is busy. Please try again later.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function games28_private.limit_report_intake() from public, anon, authenticated;
