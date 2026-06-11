-- 20260611_001_milestones_bucket_family_scoped.sql
-- APPLIED TO PRODUCTION 2026-06-11 (as `milestones_bucket_family_scoped`).
--
-- Before: a single ALL policy (`milestones_authenticated`) let ANY signed-in
-- user read, list, overwrite and delete milestone photos of EVERY family.
--
-- After: each operation requires that the photo's path
-- (`<child_id>/<month>.jpg`, see uploadMilestonePhoto in src/lib/imageUpload.js)
-- points at a child that belongs to the caller's family. Public CDN URLs keep
-- working (they don't consult storage.objects RLS); only API access is scoped.

begin;

drop policy if exists "milestones_authenticated" on storage.objects;

create policy "Milestones read own family"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'milestones'
    and exists (
      select 1 from public.children c
      where c.id::text = split_part(name, '/', 1)
        and c.family_id = public.get_my_family_id()
    )
  );

create policy "Milestones insert own family"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'milestones'
    and exists (
      select 1 from public.children c
      where c.id::text = split_part(name, '/', 1)
        and c.family_id = public.get_my_family_id()
    )
  );

create policy "Milestones update own family"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'milestones'
    and exists (
      select 1 from public.children c
      where c.id::text = split_part(name, '/', 1)
        and c.family_id = public.get_my_family_id()
    )
  )
  with check (
    bucket_id = 'milestones'
    and exists (
      select 1 from public.children c
      where c.id::text = split_part(name, '/', 1)
        and c.family_id = public.get_my_family_id()
    )
  );

create policy "Milestones delete own family"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'milestones'
    and exists (
      select 1 from public.children c
      where c.id::text = split_part(name, '/', 1)
        and c.family_id = public.get_my_family_id()
    )
  );

commit;
