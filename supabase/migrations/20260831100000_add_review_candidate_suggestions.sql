-- Suggestions are extracted from an official announcement but are never
-- published until an authenticated Games28 admin approves the record.
alter table public.qualification_review_candidates
  add column if not exists suggested_record jsonb;

comment on column public.qualification_review_candidates.suggested_record is
  'Machine-prepared record prefill derived from official evidence; requires admin approval before publication.';
