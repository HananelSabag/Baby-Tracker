# Migrations — generated 2026-04-26

These three migrations address findings from the Supabase audit. They are **not**
applied to production. Apply them via your normal flow:

1. `supabase db push` to a Supabase branch (or your staging project)
2. Verify the app, the push edge function, and avatar uploads still work
3. Merge / promote to prod

| File | What it does | Risk |
|------|--------------|------|
| `20260426_001_lock_down_push_notification_log.sql` | Drops the `WITH USING (true)` policy that lets anon/authenticated read+write the entire push log. service_role still works (bypasses RLS). | Low — only the edge function writes here, and it uses service_role. |
| `20260426_002_avatars_bucket_no_listing.sql` | Removes the public SELECT policy (avatar URLs continue to work), and scopes INSERT/UPDATE so a member can only write their own `members/<id>.*` avatar. The `children/` folder stays writable by any authed user in the family because the SPA needs to upload before `child.id` exists. | Medium — verify avatar upload from Profile, Family page, and Setup still work after applying. |
| `20260426_003_rls_initplan_perf.sql` | Wraps `auth.uid()` in `(select auth.uid())` for the push_subscriptions policy and adds the two missing FK indexes the perf linter asked for. | Low — pure performance, identical semantics. |

**Pre-flight reminder**: never run `supabase db reset` against the prod project.
The user has live data and explicitly asked us not to delete anything.
