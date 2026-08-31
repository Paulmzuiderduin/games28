alter table public.qualification_review_candidates
  drop constraint if exists qualification_review_candidates_status_check;

alter table public.qualification_review_candidates
  add constraint qualification_review_candidates_status_check
  check (status in ('pending', 'review_later', 'approved', 'rejected'));

alter table public.qualification_review_audit
  drop constraint if exists qualification_review_audit_action_check;

alter table public.qualification_review_audit
  add constraint qualification_review_audit_action_check
  check (action in ('created', 'review_later', 'reopened', 'approved', 'rejected'));

create or replace function public.set_qualification_review_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  audit_action text;
begin
  if tg_op = 'INSERT' then
    insert into public.qualification_review_audit (candidate_id, action, note, record_snapshot, actor_id)
    values (new.id, 'created', null, new.confirmation_record, null);
  elsif old.status is distinct from new.status then
    audit_action := case
      when new.status = 'pending' then 'reopened'
      else new.status
    end;

    insert into public.qualification_review_audit (candidate_id, action, note, record_snapshot, actor_id)
    values (new.id, audit_action, new.resolution_note, new.confirmation_record, (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke all on function public.set_qualification_review_audit() from public, anon, authenticated;
