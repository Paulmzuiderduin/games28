begin;
select public.sync_games28_quota_snapshot(jsonb_build_object('checkedAt',now()+interval '1 minute','quotas',jsonb_build_array(jsonb_build_object('id','qa-alias-old','recordKey','qa-same-quota','noc','NED','sport','Athletics','subjectType','noc_quota','quotaCount',1,'canonicalEventKey','athletics:men-100m','linkable',true,'occupants','[]'::jsonb))));
insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values
('qa-alias-person','test','https://example.com','Test only','Test only',now(),'approved','{"id":"qa-alias-person","noc":"NED","sport":"Athletics","subjectType":"athlete","state":"selected","athleteName":"QA Athlete","allocationRecordId":"qa-alias-old","canonicalEventKey":"athletics:men-100m","sourcePublishedAt":"2028-06-01"}');
select public.sync_games28_quota_snapshot(jsonb_build_object('checkedAt',now()+interval '2 minutes','quotas',jsonb_build_array(jsonb_build_object('id','qa-alias-new','recordKey','qa-same-quota','noc','NED','sport','Athletics','subjectType','noc_quota','quotaCount',1,'canonicalEventKey','athletics:men-100m','linkable',true,'occupants','[{"id":"qa-alias-person","name":"QA Athlete","subjectType":"athlete","sourcePublishedAt":"2028-06-01"}]'::jsonb))));
select games28_private.quota_occupancy(id,payload,'','pending',null) as occupied, jsonb_array_length(payload->'occupants') as expected_occupied from games28_private.quota_registry where id='qa-alias-new';
do $$
declare link text; counted bigint;
begin
  select games28_private.quota_occupancy(id,payload,'','pending',null) into counted
    from games28_private.quota_registry where id='qa-alias-new';
  if counted<>1 then raise exception 'Corrected quota lost its occupant'; end if;
  foreach link in array array['qa-alias-old','qa-alias-new'] loop
    begin
      insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values
      ('qa-alias-extra','test','https://example.com','Test only','Test only',now(),'approved',jsonb_build_object('id','qa-alias-extra','noc','NED','sport','Athletics','subjectType','athlete','state','selected','athleteName','QA Extra','allocationRecordId',link,'canonicalEventKey','athletics:men-100m','sourcePublishedAt','2028-06-02'));
      raise exception 'Overcapacity accepted through alias';
    exception when raise_exception then
      if sqlerrm not like 'This quota is already full%' then raise; end if;
    end;
  end loop;
  update public.qualification_review_candidates set confirmation_record=confirmation_record || '{"notes":"Read-only evidence correction"}' where id='qa-alias-person';
  insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values
  ('qa-alias-replacement','test','https://example.com','Test only','Test only',now(),'approved','{"id":"qa-alias-replacement","noc":"NED","sport":"Athletics","subjectType":"athlete","state":"selected","athleteName":"QA Replacement","allocationRecordId":"qa-alias-new","canonicalEventKey":"athletics:men-100m","sourcePublishedAt":"2028-06-02","supersedesId":"qa-alias-person"}');
  select games28_private.quota_occupancy(id,payload,'','pending',null) into counted from games28_private.quota_registry where id='qa-alias-new';
  if counted<>1 then raise exception 'Replacement did not retain exactly one occupied place'; end if;
  update public.qualification_review_candidates set confirmation_record=confirmation_record || '{"state":"withdrawn"}' where id='qa-alias-replacement';
  select games28_private.quota_occupancy(id,payload,'','pending',null) into counted from games28_private.quota_registry where id='qa-alias-new';
  if counted<>0 then raise exception 'Withdrawal failed or resurrected original athlete'; end if;
end $$;
do $$
begin
  insert into games28_private.quota_registry(id,payload,active,checked_at)
    select 'qa-alias-ambiguous',payload || '{"id":"qa-alias-ambiguous"}',true,checked_at
    from games28_private.quota_registry where id='qa-alias-new';
  if games28_private.current_quota_id('qa-alias-old')<>'qa-alias-old' then raise exception 'Ambiguous aliases must not pick a winner'; end if;
  update games28_private.quota_registry set active=false where id='qa-alias-ambiguous';
  if games28_private.current_quota_id('qa-alias-old')<>'qa-alias-new' then raise exception 'Unique alias lost'; end if;
  update games28_private.quota_registry set payload=payload || '{"noc":"USA"}' where id='qa-alias-new';
  if games28_private.current_quota_id('qa-alias-old')<>'qa-alias-old' then raise exception 'Cross-country alias accepted'; end if;
  update games28_private.quota_registry set payload=payload || '{"noc":"NED","canonicalEventKey":"athletics:men-200m"}' where id='qa-alias-new';
  if games28_private.current_quota_id('qa-alias-old')<>'qa-alias-old' then raise exception 'Cross-event alias accepted'; end if;
end $$;
select true as alias_capacity_replacement_withdrawal_passed;
rollback;
