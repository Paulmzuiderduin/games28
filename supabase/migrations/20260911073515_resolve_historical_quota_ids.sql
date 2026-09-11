-- Resolve source-ID changes only within one unambiguous, verified quota identity.
create function games28_private.current_quota_id(p_id text)
returns text language sql volatile security invoker set search_path = '' as $$
  select case when exists(select 1 from games28_private.quota_registry where id=p_id and active)
    then p_id else coalesce((
      select case when count(*)=1 then min(current.id) end
      from games28_private.quota_registry old
      join games28_private.quota_registry current on current.active
        and current.payload->>'recordKey'=old.payload->>'recordKey'
        and current.payload->>'noc'=old.payload->>'noc'
        and current.payload->>'sport'=old.payload->>'sport'
        and current.payload->>'subjectType'=old.payload->>'subjectType'
        and current.payload->>'canonicalEventKey'=old.payload->>'canonicalEventKey'
      where old.id=p_id and nullif(old.payload->>'recordKey','') is not null
        and nullif(old.payload->>'canonicalEventKey','') is not null
    ),p_id) end;
$$;
revoke all on function games28_private.current_quota_id(text) from public, anon, authenticated;
grant execute on function games28_private.current_quota_id(text) to service_role;

create or replace function games28_private.quota_occupancy(p_quota_id text, p_quota jsonb, p_candidate_id text, p_status text, p_record jsonb)
returns bigint language sql volatile security invoker set search_path = '' as $$
  with current_reviews as (
    select id, status, confirmation_record as record from public.qualification_review_candidates where id<>p_candidate_id
    union all select p_candidate_id, p_status, p_record
  ), review_occupants as (
    select record->>'id' as record_id, record->>'subjectType' as kind,
      coalesce(record->>'athleteName',record->>'teamName') as name
    from current_reviews where status='approved' and games28_private.current_quota_id(record->>'allocationRecordId')=games28_private.current_quota_id(p_quota_id)
      and record->>'state' in ('earned','selected','entered')
  ), imported as (
    select person->>'id' as record_id, person->>'subjectType' as kind, person->>'name' as name
    from games28_private.quota_registry registry,
      lateral jsonb_array_elements(registry.payload->'occupants') person
    where registry.id=games28_private.current_quota_id(p_quota_id) and registry.active
      and not exists(select 1 from current_reviews where record->>'id'=person->>'id')
  ), occupants as (
    select * from review_occupants union all select * from imported
  )
  select count(distinct (kind,lower(regexp_replace(trim(name),'\s+',' ','g'))))
  from occupants where not exists (
    select 1 from current_reviews r where r.status='approved'
      and r.record->>'supersedesId'=occupants.record_id
      and games28_private.current_quota_id(r.record->>'allocationRecordId')=games28_private.current_quota_id(p_quota_id)
      and r.record->>'noc'=p_quota->>'noc'
      and r.record->>'canonicalEventKey'=p_quota->>'canonicalEventKey'
      and r.record->>'state' in ('earned','selected','entered','withdrawn','replaced')
      and r.record->>'id'<>occupants.record_id
  );
$$;
revoke all on function games28_private.quota_occupancy(text,jsonb,text,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function games28_private.quota_occupancy(text,jsonb,text,text,jsonb) to service_role;

-- Terminal records with replacement links can affect occupancy too.
create or replace function games28_private.guard_quota_selection()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  selection jsonb := new.confirmation_record;
  quota_id text;
  quota jsonb;
  capacity integer;
  occupied integer;
  selection_name text;
  quota_status text;
  replaced_record jsonb;
begin
  -- Serialize every review transition, including withdrawals and review-later.
  update games28_private.quota_guard_state set revision=revision+1 where singleton;
  -- Resolve only after acquiring the same lock used by snapshot publication.
  quota_id := games28_private.current_quota_id(nullif(selection->>'allocationRecordId',''));
  if tg_op='UPDATE' and old.confirmation_record->>'subjectType' in ('noc_quota','team_quota') then
    occupied := games28_private.quota_occupancy(old.confirmation_record->>'id',old.confirmation_record,new.id,new.status,selection);
    if occupied>0 then
      if new.status<>'approved' or coalesce(selection->>'state','') in ('withdrawn','replaced')
        or selection->>'id' is distinct from old.confirmation_record->>'id'
        or selection->>'noc' is distinct from old.confirmation_record->>'noc'
        or selection->>'canonicalEventKey' is distinct from old.confirmation_record->>'canonicalEventKey'
        or selection->>'subjectType' is distinct from old.confirmation_record->>'subjectType'
      then raise exception 'Review linked selections before changing or withdrawing this occupied quota'; end if;
      if coalesce(selection->>'quotaCount','') !~ '^[1-9][0-9]*$'
        or (selection->>'quotaCount')::integer<occupied then
        raise exception 'Quota capacity cannot be lower than its linked selections';
      end if;
    end if;
  end if;
  if new.status <> 'approved' or quota_id is null
    or (coalesce(selection->>'state','') in ('withdrawn','replaced')
      and nullif(selection->>'supersedesId','') is null) then return new; end if;
  if (select auth.uid()) is not null and not exists (
    select 1 from public.games28_admins where user_id=(select auth.uid())
  ) then raise exception 'Admin membership required'; end if;
  if coalesce(selection->>'state','') not in ('earned','selected','entered','withdrawn','replaced') then
    raise exception 'Only a confirmed named selection can fill a quota';
  end if;

  -- A newly approved quota need not wait for the next daily refresh.
  select confirmation_record, status into quota, quota_status from public.qualification_review_candidates
    where confirmation_record->>'id'=quota_id
    order by updated_at desc limit 1;
  if not found then
    select payload into quota from games28_private.quota_registry where id=quota_id and active;
  elsif quota_status <> 'approved' then
    quota := null;
  end if;
  if quota is null or coalesce(quota->>'state','allocated') in ('withdrawn','replaced') then
    raise exception 'The linked quota is not active. Refresh the queue.';
  end if;
  if nullif(quota->>'canonicalEventKey','') is null
    or quota->>'canonicalEventKey' is distinct from selection->>'canonicalEventKey'
    or quota->>'noc' is distinct from selection->>'noc' then
    raise exception 'The quota and selection must have the same confirmed country and event.';
  end if;
  if not ((quota->>'subjectType'='noc_quota' and selection->>'subjectType'='athlete')
    or (quota->>'subjectType'='team_quota' and selection->>'subjectType'='team')) then
    raise exception 'Match individual athletes to individual quotas and teams to team quotas.';
  end if;
  if coalesce(quota->>'quotaCount','') !~ '^[1-9][0-9]*$' then raise exception 'Invalid quota capacity'; end if;
  capacity := (quota->>'quotaCount')::integer;
  selection_name := lower(regexp_replace(trim(coalesce(selection->>'athleteName',selection->>'teamName','')), '\s+', ' ', 'g'));
  if selection_name='' then raise exception 'A named selection is required'; end if;
  if nullif(selection->>'supersedesId','') is not null then
    select confirmation_record into replaced_record from public.qualification_review_candidates
      where confirmation_record->>'id'=selection->>'supersedesId' and status='approved'
      order by updated_at desc limit 1;
    if not found then
      select registry.payload || person || jsonb_build_object('allocationRecordId',quota_id)
      into replaced_record from games28_private.quota_registry registry,
        lateral jsonb_array_elements(registry.payload->'occupants') person
      where registry.id=quota_id and registry.active and person->>'id'=selection->>'supersedesId';
    end if;
    if replaced_record is null
      or replaced_record->>'id'=selection->>'id'
      or games28_private.current_quota_id(replaced_record->>'allocationRecordId') is distinct from quota_id
      or replaced_record->>'canonicalEventKey' is distinct from selection->>'canonicalEventKey'
      or replaced_record->>'noc' is distinct from selection->>'noc'
      or replaced_record->>'subjectType' is distinct from selection->>'subjectType'
      or nullif(selection->>'sourcePublishedAt','') is null
      or nullif(replaced_record->>'sourcePublishedAt','') is null
      or (selection->>'sourcePublishedAt')::timestamptz <= (replaced_record->>'sourcePublishedAt')::timestamptz
    then raise exception 'A replacement needs an existing same-quota selection and newer official evidence'; end if;
    if exists (
      with recursive chain(id, next_id, seen) as (
        select replaced_record->>'id', replaced_record->>'supersedesId', array[selection->>'id']
        union all
        select c.confirmation_record->>'id', c.confirmation_record->>'supersedesId', chain.seen || chain.id
        from chain join public.qualification_review_candidates c on c.confirmation_record->>'id'=chain.next_id
        where not chain.id=any(chain.seen)
      ) select 1 from chain where id=any(seen)
    ) then raise exception 'Circular qualification replacement'; end if;
  end if;

  occupied := games28_private.quota_occupancy(quota_id,quota,new.id,new.status,selection);
  if occupied>capacity then
    raise exception 'This quota is already full. Refresh the queue and review the existing selection.';
  end if;
  return new;
end;
$$;
