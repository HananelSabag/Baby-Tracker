-- 20260426_001_lock_down_push_notification_log.sql
--
-- The current `service_role_all_log` policy on push_notification_log is bound
-- to the `public` role with `USING (true)`. That means any authenticated or
-- anon client can read/insert/update/delete every row in the table. Rows
-- contain family_id and child_id, so this leaks family/child relationships
-- to anyone with the publishable anon key (which is hard-coded in the SPA
-- and therefore public).
--
-- The intent is "service role only" for this table, since the push pipeline
-- writes here from an edge function. service_role bypasses RLS anyway, so we
-- only need a restrictive policy for everyone else.
--
-- SAFE: only adjusts a policy on a log table; existing rows are untouched.
-- Run on a Supabase branch first, verify the edge function still writes,
-- then merge.

begin;

-- Drop the over-permissive policy
drop policy if exists service_role_all_log on public.push_notification_log;

-- No SELECT/INSERT/UPDATE/DELETE policy for authenticated/anon = denied by default.
-- service_role bypasses RLS, so the push edge function continues to work.

-- Belt-and-braces: revoke any direct table grants from anon/authenticated so
-- the table is also hidden from the GraphQL anon introspection lint.
revoke all on public.push_notification_log from anon, authenticated;

commit;
