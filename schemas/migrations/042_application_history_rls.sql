-- 042_application_history_rls.sql
--
-- Lock down public.application_history.
--
-- The table shipped with RLS disabled and no policies, which was inert while
-- nothing wrote to it: lib/application-history.ts was imported but never
-- called, so every row count was zero. PUT /api/applications/[id] now records
-- each status transition there (Today reads it to answer "did this user just
-- start a new job?", which applications.updated_at cannot answer because the
-- handle_updated_at trigger bumps it on any edit). With real rows in it, an
-- unprotected table means any authenticated client can read every user's
-- application history — company names, roles, and the dates they were
-- rejected — straight from the anon key.
--
-- application_history has no user_id of its own, so ownership is derived
-- through its parent application. The subquery is indexed: application_id is
-- the FK column and applications' primary key is id.

alter table public.application_history enable row level security;

-- Owning the parent application is what grants access to its history.
create policy "Users can view their own application history"
  on public.application_history
  for select
  using (
    exists (
      select 1
      from public.applications a
      where a.id = application_history.application_id
        and a.user_id = auth.uid()
    )
  );

create policy "Users can insert their own application history"
  on public.application_history
  for insert
  with check (
    exists (
      select 1
      from public.applications a
      where a.id = application_history.application_id
        and a.user_id = auth.uid()
    )
  );

-- No update or delete policy: history is append-only. The ON DELETE CASCADE on
-- application_history.application_id FK still removes a row when its
-- application goes, and the service-role key bypasses RLS entirely.
