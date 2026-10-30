-- Synthetic regression: ten reports from one forwarded IP are accepted, the
-- eleventh in the same hour is rejected. Always roll back.
begin;
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', true);
insert into public.community_reports (category, details)
select 'other', 'Synthetic report detail that is long enough'
from generate_series(1, 10);
do $$
begin
  begin
    insert into public.community_reports (category, details)
    values ('other', 'Synthetic report detail that is long enough');
    raise exception 'Test failure: report rate limit accepted the eleventh report';
  exception when raise_exception then
    if sqlerrm not like 'Report intake is busy%' then raise; end if;
  end;
end $$;
select count(*) = 10 as per_ip_limit_enforced from public.community_reports where request_ip_hash = md5('203.0.113.9');
rollback;
