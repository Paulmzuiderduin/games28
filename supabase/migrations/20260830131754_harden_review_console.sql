-- This helper is used inside RLS policies only; it must not be exposed as an RPC.
revoke execute on function public.is_games28_admin() from anon, authenticated;

-- Cover admin-resolution lookups and keep audit reads efficient as the queue grows.
create index if not exists qualification_review_candidates_resolved_by_idx
  on public.qualification_review_candidates (resolved_by)
  where resolved_by is not null;

create index if not exists qualification_review_audit_actor_id_idx
  on public.qualification_review_audit (actor_id)
  where actor_id is not null;
