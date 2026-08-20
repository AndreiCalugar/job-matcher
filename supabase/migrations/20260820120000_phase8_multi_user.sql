-- Phase 8: multi-user. Ownership on every user-scoped table, cascade on
-- delete, and RLS policies for the authenticated role. The app server
-- still uses the service role and scopes every query by profile; these
-- policies are defence in depth and the contract a future client-side
-- path would run under.

-- ---------------------------------------------------------------------------
-- Ownership
-- ---------------------------------------------------------------------------
-- profile.user_id exists (nullable since Phase 3). Make the link to auth
-- cascade: deleting the auth user removes everything below it.
alter table profile
  drop constraint if exists profile_user_id_fkey,
  add constraint profile_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
create index if not exists profile_user_idx on profile (user_id);

-- Jobs: feed postings are shared (a job ad is public data); manual pastes
-- belong to whoever pasted them. null owner = shared.
alter table job add column owner_profile_id uuid references profile(id) on delete cascade;
create index job_owner_idx on job (owner_profile_id) where owner_profile_id is not null;

-- Sources: feeds are shared (unique on kind+identifier already); record
-- who subscribed so their /sources page lists it.
create table source_subscription (
  profile_id  uuid not null references profile(id) on delete cascade,
  source_id   uuid not null references source(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, source_id)
);

-- usage_event: per-profile metering. user_id stays for auth-level joins.
alter table usage_event add column profile_id uuid references profile(id) on delete cascade;
create index usage_event_profile_idx on usage_event (profile_id, created_at desc);

-- blocked_generation → match → profile already cascades. failed_ingest has
-- no user data beyond job ids (cascade via job where set).

-- ---------------------------------------------------------------------------
-- Helper: the caller's profile ids (a user may re-upload; several rows).
-- ---------------------------------------------------------------------------
create or replace function my_profile_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from profile where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Policies (authenticated role). Service role bypasses RLS by design.
-- ---------------------------------------------------------------------------
create policy profile_own on profile for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy search_profile_own on search_profile for all to authenticated
  using (profile_id in (select my_profile_ids())) with check (profile_id in (select my_profile_ids()));

create policy match_own on match for all to authenticated
  using (profile_id in (select my_profile_ids())) with check (profile_id in (select my_profile_ids()));

create policy application_kit_own on application_kit for all to authenticated
  using (profile_id in (select my_profile_ids())) with check (profile_id in (select my_profile_ids()));

create policy application_own on application for all to authenticated
  using (profile_id in (select my_profile_ids())) with check (profile_id in (select my_profile_ids()));

create policy interview_round_own on interview_round for all to authenticated
  using (application_id in (select id from application where profile_id in (select my_profile_ids())));

create policy usage_event_own on usage_event for select to authenticated
  using (profile_id in (select my_profile_ids()));

create policy blocked_generation_own on blocked_generation for select to authenticated
  using (match_id in (select id from match where profile_id in (select my_profile_ids())));

-- Jobs: shared feed rows readable by everyone signed in; manual pastes
-- only by their owner. Writes go through the server.
create policy job_read on job for select to authenticated
  using (owner_profile_id is null or owner_profile_id in (select my_profile_ids()));

create policy source_read on source for select to authenticated using (true);
create policy company_read on company for select to authenticated using (true);
create policy source_subscription_own on source_subscription for all to authenticated
  using (profile_id in (select my_profile_ids())) with check (profile_id in (select my_profile_ids()));
