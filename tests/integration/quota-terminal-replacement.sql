-- Synthetic regression: always roll back the quota snapshot and candidates.
begin;
select public.sync_games28_quota_snapshot(jsonb_build_object('checkedAt',now()+interval '1 minute','quotas',jsonb_build_array(jsonb_build_object('id','qa-terminal-quota','noc','NED','sport','Athletics','subjectType','noc_quota','quotaCount',1,'canonicalEventKey','athletics:men-100m','linkable',true,'occupants','[]'::jsonb))));

do $$ begin
 begin
insert into public.qualification_review_candidates(id,source_id,source_url,extracted_evidence,reason,detected_at,status,confirmation_record) values
('qa-terminal-a','test','https://example.com','Test only','Test only',now(),'approved','{"id":"qa-a","noc":"NED","sport":"Athletics","subjectType":"athlete","state":"selected","athleteName":"QA A","allocationRecordId":"qa-terminal-quota","canonicalEventKey":"athletics:men-100m","sourcePublishedAt":"2028-06-01"}'),
('qa-terminal-withdrawal','test','https://example.com','Test only','Test only',now(),'approved','{"id":"qa-withdrawal","noc":"NED","sport":"Athletics","subjectType":"athlete","state":"withdrawn","athleteName":"Unrelated QA","allocationRecordId":"qa-terminal-quota","canonicalEventKey":"athletics:men-100m","supersedesId":"qa-a","sourcePublishedAt":"2028-01-01"}'),
('qa-terminal-b','test','https://example.com','Test only','Test only',now(),'approved','{"id":"qa-b","noc":"NED","sport":"Athletics","subjectType":"athlete","state":"selected","athleteName":"QA B","allocationRecordId":"qa-terminal-quota","canonicalEventKey":"athletics:men-100m","sourcePublishedAt":"2028-06-02"}');

raise exception 'Test failed: terminal replacement bypassed capacity';
exception when raise_exception then
 if sqlerrm <> 'A replacement needs an existing same-quota selection and newer official evidence' then raise; end if;
end;
end $$;
select not exists(select 1 from public.qualification_review_candidates where id like 'qa-terminal-%') as invalid_batch_rejected;

rollback;
