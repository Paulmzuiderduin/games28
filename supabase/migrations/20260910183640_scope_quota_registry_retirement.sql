create or replace function public.sync_games28_quota_snapshot(p_snapshot jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  incoming_time timestamptz;
  prior_time timestamptz;
  row_data jsonb;
  row_count integer;
begin
  if jsonb_typeof(p_snapshot->'quotas') is distinct from 'array' then
    raise exception 'A complete quota array is required';
  end if;
  incoming_time := (p_snapshot->>'checkedAt')::timestamptz;
  if incoming_time is null then raise exception 'Snapshot timestamp is required'; end if;
  -- UPDATE serializes readers/writers and forces stale repeatable-read callers
  -- to retry rather than evaluate capacity against an obsolete transaction view.
  update games28_private.quota_guard_state set revision = revision + 1
    where singleton returning checked_at into prior_time;
  if prior_time is not null and incoming_time <= prior_time then return 0; end if;
  if exists (
    select 1 from jsonb_array_elements(p_snapshot->'quotas') q
    group by q->>'id' having count(*) > 1
  ) then raise exception 'Duplicate quota identity'; end if;
  for row_data in select value from jsonb_array_elements(p_snapshot->'quotas') loop
    if nullif(row_data->>'id','') is null
      or nullif(row_data->>'noc','') is null
      or nullif(row_data->>'sport','') is null
      or coalesce(row_data->>'subjectType','') not in ('noc_quota','team_quota')
      or coalesce(row_data->>'quotaCount','') !~ '^[1-9][0-9]*$'
      or jsonb_typeof(row_data->'occupants') is distinct from 'array'
      or jsonb_typeof(row_data->'linkable') is distinct from 'boolean'
    then raise exception 'Incomplete quota registry record'; end if;
    if (row_data->>'linkable')::boolean and nullif(row_data->>'canonicalEventKey','') is null then
      raise exception 'Linkable quota requires canonical event';
    end if;
    if jsonb_array_length(row_data->'occupants') > (row_data->>'quotaCount')::integer then
      raise exception 'Quota snapshot exceeds capacity';
    end if;
  end loop;
  -- Scope retirement to active entries; the REST role enforces safeupdate.
  update games28_private.quota_registry set active = false, checked_at = incoming_time
    where active;
  insert into games28_private.quota_registry(id, payload, active, checked_at)
    select value->>'id', value, true, incoming_time from jsonb_array_elements(p_snapshot->'quotas')
    on conflict(id) do update set payload=excluded.payload, active=true, checked_at=excluded.checked_at;
  get diagnostics row_count = row_count;
  for row_data in select value from jsonb_array_elements(p_snapshot->'quotas') loop
    if games28_private.quota_occupancy(row_data->>'id',row_data,'','pending',null) > (row_data->>'quotaCount')::integer then
      raise exception 'New snapshot conflicts with recently approved quota selections';
    end if;
  end loop;
  update games28_private.quota_guard_state set checked_at = incoming_time where singleton;
  return row_count;
end;
$$;
