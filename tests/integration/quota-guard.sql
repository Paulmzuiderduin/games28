-- Run after the draft migration inside a transaction, then ROLLBACK.
select public.sync_games28_quota_snapshot('{"checkedAt":"2026-09-09T12:00:00Z","quotas":[{"id":"guard-fixture-quota","noc":"NED","sport":"Athletics","subjectType":"noc_quota","quotaCount":1,"canonicalEventKey":"athletics:100m-men","linkable":true,"occupants":[]}]}');
insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values
('guard-fixture-one','test','https://example.com','Test only','Test only',now(),'approved','{"id":"guard-athlete-one","noc":"NED","sport":"Athletics","subjectType":"athlete","state":"selected","athleteName":"Test One","canonicalEventKey":"athletics:100m-men","allocationRecordId":"guard-fixture-quota","sourcePublishedAt":"2028-06-01"}');
insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values
('guard-fixture-quota-review','test','https://example.com','Test only','Test only',now(),'approved','{"id":"guard-fixture-quota","noc":"NED","sport":"Athletics","subjectType":"noc_quota","state":"allocated","quotaCount":1,"canonicalEventKey":"athletics:100m-men"}');
do $$
declare second_record jsonb := '{"id":"guard-athlete-two","noc":"NED","sport":"Athletics","subjectType":"athlete","state":"selected","athleteName":"Test Two","canonicalEventKey":"athletics:100m-men","allocationRecordId":"guard-fixture-quota","sourcePublishedAt":"2028-06-02"}';
begin
  begin
    update public.qualification_review_candidates set confirmation_record=confirmation_record || '{"quotaCount":0}' where id='guard-fixture-quota-review';
    raise exception 'Test failure: invalid reduction accepted';
  exception when raise_exception then if sqlerrm not like 'Quota capacity cannot%' then raise; end if; end;
  begin
    update public.qualification_review_candidates set confirmation_record=confirmation_record || '{"state":"withdrawn"}' where id='guard-fixture-quota-review';
    raise exception 'Test failure: occupied quota withdrawn';
  exception when raise_exception then if sqlerrm not like 'Review linked selections%' then raise; end if; end;
  begin
    insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values
    ('guard-fixture-two','test','https://example.com','Test only','Test only',now(),'approved',second_record);
    raise exception 'Test failure: overcapacity accepted';
  exception when raise_exception then if sqlerrm not like 'This quota is already full%' then raise; end if; end;
  insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values
    ('guard-fixture-two','test','https://example.com','Test only','Test only',now(),'approved',second_record || '{"supersedesId":"guard-athlete-one"}');
  begin
    update public.qualification_review_candidates set confirmation_record=confirmation_record || '{"supersedesId":"guard-athlete-two","sourcePublishedAt":"2028-06-03"}' where id='guard-fixture-one';
    raise exception 'Test failure: cycle accepted';
  exception when raise_exception then if sqlerrm <> 'Circular qualification replacement' then raise; end if; end;
  update public.qualification_review_candidates set confirmation_record=confirmation_record || '{"state":"withdrawn"}' where id='guard-fixture-two';
  -- The original remains superseded even after its replacement withdraws.
  insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values
    ('guard-fixture-three','test','https://example.com','Test only','Test only',now(),'approved',second_record || '{"id":"guard-athlete-three","athleteName":"Test Three"}');
end $$;
select count(*) as retained_history_records from public.qualification_review_candidates where id like 'guard-fixture-%';
update public.qualification_review_candidates set confirmation_record=confirmation_record || '{"quotaCount":2}' where id='guard-fixture-quota-review';
insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values
('guard-fixture-four','test','https://example.com','Test only','Test only',now(),'approved','{"id":"guard-athlete-four","noc":"NED","sport":"Athletics","subjectType":"athlete","state":"selected","athleteName":"Test Four","canonicalEventKey":"athletics:100m-men","allocationRecordId":"guard-fixture-quota","sourcePublishedAt":"2028-06-04"}');
do $$ begin
 begin
  perform public.sync_games28_quota_snapshot('{"checkedAt":"2026-09-10T12:00:00Z","quotas":[{"id":"guard-fixture-quota","noc":"NED","sport":"Athletics","subjectType":"noc_quota","quotaCount":1,"canonicalEventKey":"athletics:100m-men","linkable":true,"occupants":[]}]}');
  raise exception 'Test failure: stale capacity replaced recent approvals';
 exception when raise_exception then if sqlerrm <> 'New snapshot conflicts with recently approved quota selections' then raise; end if; end;
end $$;
select count(*) as retained_history_records from public.qualification_review_candidates where id like 'guard-fixture-%';
