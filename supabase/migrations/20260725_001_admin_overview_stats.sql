-- Per-member and per-family aggregates for the admin panel.
--
-- Replaces the panel's N+1: it used to run one "last event" query per family.
-- Doing the aggregation in SQL keeps the admin edge function to a fixed number
-- of round trips regardless of how many families exist.
--
-- SECURITY DEFINER so the function can read across every family, with execute
-- revoked from anon/authenticated and granted only to service_role — i.e. only
-- the admin edge function can call these, never a browser client.

create or replace function public.admin_member_event_counts()
returns table (member_id uuid, event_count bigint)
language sql
security definer
set search_path = public
as $$
  select e.member_id, count(*)::bigint
  from public.events e
  where e.member_id is not null
  group by e.member_id
$$;

create or replace function public.admin_family_stats()
returns table (
  family_id uuid,
  member_count bigint,
  child_count bigint,
  event_count bigint,
  last_event_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    f.id,
    (select count(*) from public.family_members m where m.family_id = f.id)::bigint,
    (select count(*) from public.children c where c.family_id = f.id)::bigint,
    (select count(*) from public.events e where e.family_id = f.id)::bigint,
    (select max(e.occurred_at) from public.events e where e.family_id = f.id)
  from public.families f
$$;

revoke all on function public.admin_member_event_counts() from public, anon, authenticated;
revoke all on function public.admin_family_stats() from public, anon, authenticated;
grant execute on function public.admin_member_event_counts() to service_role;
grant execute on function public.admin_family_stats() to service_role;
