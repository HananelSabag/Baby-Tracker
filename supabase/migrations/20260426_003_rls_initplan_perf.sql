-- 20260426_003_rls_initplan_perf.sql
--
-- Performance lint: `member_own_push_subs` calls auth.uid() per row, which
-- scales O(n) on the table. Wrapping in `(select auth.uid())` lets PG cache
-- the value once per query. Functionally identical.
--
-- SAFE: same predicate, just better-planned. No data touched.

begin;

drop policy if exists member_own_push_subs on public.push_subscriptions;

create policy member_own_push_subs
  on public.push_subscriptions
  for all
  to authenticated
  using (
    member_id in (
      select id from public.family_members
      where auth_user_id = (select auth.uid())
    )
  )
  with check (
    member_id in (
      select id from public.family_members
      where auth_user_id = (select auth.uid())
    )
  );

-- Add the indexes the linter asked for. tiny tables today, but cheap insurance.
create index if not exists push_subscriptions_family_id_idx
  on public.push_subscriptions (family_id);

create index if not exists push_subscriptions_member_id_idx
  on public.push_subscriptions (member_id);

commit;
