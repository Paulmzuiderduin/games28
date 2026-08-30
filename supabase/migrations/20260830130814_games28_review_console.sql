create table if not exists public.games28_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.qualification_review_candidates (
  id text primary key,
  source_id text not null,
  source_url text not null check (source_url ~ '^https://'),
  extracted_evidence text not null,
  reason text not null,
  detected_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  confirmation_record jsonb,
  resolution_note text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qualification_review_audit (
  id bigint generated always as identity primary key,
  candidate_id text not null references public.qualification_review_candidates(id) on delete cascade,
  action text not null check (action in ('created', 'approved', 'rejected')),
  note text,
  record_snapshot jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists qualification_review_candidates_status_detected_at_idx
  on public.qualification_review_candidates (status, detected_at desc);
create index if not exists qualification_review_audit_candidate_id_idx
  on public.qualification_review_audit (candidate_id, created_at desc);

alter table public.games28_admins enable row level security;
alter table public.qualification_review_candidates enable row level security;
alter table public.qualification_review_audit enable row level security;

create or replace function public.is_games28_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.games28_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_games28_admin() from public;
grant execute on function public.is_games28_admin() to authenticated;

create policy "Games28 admins can view their membership"
  on public.games28_admins for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Games28 admins can read review candidates"
  on public.qualification_review_candidates for select
  to authenticated
  using ((select public.is_games28_admin()));

create policy "Games28 admins can update review candidates"
  on public.qualification_review_candidates for update
  to authenticated
  using ((select public.is_games28_admin()))
  with check ((select public.is_games28_admin()));

create policy "Games28 admins can read review audit"
  on public.qualification_review_audit for select
  to authenticated
  using ((select public.is_games28_admin()));

create or replace function public.set_qualification_review_audit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.qualification_review_audit (candidate_id, action, note, record_snapshot, actor_id)
    values (new.id, 'created', null, new.confirmation_record, null);
  elsif old.status is distinct from new.status and new.status in ('approved', 'rejected') then
    insert into public.qualification_review_audit (candidate_id, action, note, record_snapshot, actor_id)
    values (new.id, new.status, new.resolution_note, new.confirmation_record, (select auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists qualification_review_audit_trigger on public.qualification_review_candidates;
create trigger qualification_review_audit_trigger
after insert or update on public.qualification_review_candidates
for each row execute function public.set_qualification_review_audit();

revoke all on public.games28_admins from anon, authenticated;
revoke all on public.qualification_review_candidates from anon;
revoke all on public.qualification_review_audit from anon;
grant select, update on public.qualification_review_candidates to authenticated;
grant select on public.qualification_review_audit to authenticated;

-- After the first magic-link sign-in, seed exactly one owner in the Supabase SQL editor:
-- insert into public.games28_admins (user_id) values ('<your auth.users UUID>');
