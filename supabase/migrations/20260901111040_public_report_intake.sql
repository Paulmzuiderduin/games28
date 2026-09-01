-- Public visitors may submit a narrow, private report. They cannot read it,
-- update it, or create qualification records directly.
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('missing_qualification', 'schedule_correction', 'qualification_correction', 'other')),
  noc text,
  sport text,
  source_url text check (source_url is null or source_url ~ '^https://'),
  details text not null check (char_length(btrim(details)) between 20 and 3000),
  reporter_email text check (reporter_email is null or char_length(reporter_email) <= 254),
  website text not null default '' check (website = ''),
  status text not null default 'pending' check (status in ('pending', 'review_later', 'converted', 'rejected')),
  resolution_note text,
  converted_candidate_id text references public.qualification_review_candidates(id),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists community_reports_status_created_at_idx
  on public.community_reports (status, created_at desc);

alter table public.community_reports enable row level security;

revoke all on public.community_reports from anon, authenticated;
grant insert on public.community_reports to anon, authenticated;
grant select, update on public.community_reports to authenticated;

drop policy if exists "Anyone can submit a Games28 community report" on public.community_reports;
create policy "Anyone can submit a Games28 community report"
  on public.community_reports for insert
  to anon, authenticated
  with check (
    category in ('missing_qualification', 'schedule_correction', 'qualification_correction', 'other')
    and char_length(btrim(details)) between 20 and 3000
    and website = ''
  );

drop policy if exists "Games28 admins can read community reports" on public.community_reports;
create policy "Games28 admins can read community reports"
  on public.community_reports for select
  to authenticated
  using (
    exists (
      select 1 from public.games28_admins
      where user_id = (select auth.uid())
    )
  );

drop policy if exists "Games28 admins can update community reports" on public.community_reports;
create policy "Games28 admins can update community reports"
  on public.community_reports for update
  to authenticated
  using (
    exists (
      select 1 from public.games28_admins
      where user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.games28_admins
      where user_id = (select auth.uid())
    )
  );

-- Only a signed-in Games28 admin can turn a visitor report into the existing
-- qualification review queue. The next daily job still performs final validation.
grant insert on public.qualification_review_candidates to authenticated;

drop policy if exists "Games28 admins can create review candidates" on public.qualification_review_candidates;
create policy "Games28 admins can create review candidates"
  on public.qualification_review_candidates for insert
  to authenticated
  with check (
    exists (
      select 1 from public.games28_admins
      where user_id = (select auth.uid())
    )
  );
