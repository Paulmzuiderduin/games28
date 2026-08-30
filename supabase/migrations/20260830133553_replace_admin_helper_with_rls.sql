-- Direct, RLS-protected membership checks avoid exposing a SECURITY DEFINER RPC.
drop policy if exists "Games28 admins can read review candidates"
  on public.qualification_review_candidates;
drop policy if exists "Games28 admins can update review candidates"
  on public.qualification_review_candidates;
drop policy if exists "Games28 admins can read review audit"
  on public.qualification_review_audit;

drop function if exists public.is_games28_admin();

grant select on public.games28_admins to authenticated;

create policy "Games28 admins can read review candidates"
  on public.qualification_review_candidates for select
  to authenticated
  using (
    exists (
      select 1 from public.games28_admins
      where user_id = (select auth.uid())
    )
  );

create policy "Games28 admins can update review candidates"
  on public.qualification_review_candidates for update
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

create policy "Games28 admins can read review audit"
  on public.qualification_review_audit for select
  to authenticated
  using (
    exists (
      select 1 from public.games28_admins
      where user_id = (select auth.uid())
    )
  );
