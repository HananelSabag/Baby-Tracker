-- Fix milestone photo upload failing with:
--   "new row violates row-level security policy" (HTTP 400)
--
-- Root cause: the four `milestones` storage.objects policies referenced an
-- UNQUALIFIED `name` inside `EXISTS (SELECT 1 FROM public.children c
-- WHERE c.id::text = split_part(name, '/', 1) ...)`. Because public.children
-- also has a `name` column, the unqualified `name` bound to children.name
-- (the child's display name, e.g. "הראל אבי") instead of the storage object
-- path. So the child id was extracted from the wrong column, never matched,
-- EXISTS was always false, and every INSERT/UPDATE/DELETE was denied.
-- (Reads still worked because the bucket is public → served via public URL,
--  which bypasses RLS — which is why the album displayed but uploads failed.)
--
-- Fix: qualify as storage.objects.name so the child id is read from the path.

drop policy if exists "Milestones insert own family" on storage.objects;
create policy "Milestones insert own family" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'milestones'
    and exists (
      select 1 from public.children c
      where c.id::text = split_part(storage.objects.name, '/', 1)
        and c.family_id = public.get_my_family_id()
    )
  );

drop policy if exists "Milestones read own family" on storage.objects;
create policy "Milestones read own family" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'milestones'
    and exists (
      select 1 from public.children c
      where c.id::text = split_part(storage.objects.name, '/', 1)
        and c.family_id = public.get_my_family_id()
    )
  );

drop policy if exists "Milestones update own family" on storage.objects;
create policy "Milestones update own family" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'milestones'
    and exists (
      select 1 from public.children c
      where c.id::text = split_part(storage.objects.name, '/', 1)
        and c.family_id = public.get_my_family_id()
    )
  )
  with check (
    bucket_id = 'milestones'
    and exists (
      select 1 from public.children c
      where c.id::text = split_part(storage.objects.name, '/', 1)
        and c.family_id = public.get_my_family_id()
    )
  );

drop policy if exists "Milestones delete own family" on storage.objects;
create policy "Milestones delete own family" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'milestones'
    and exists (
      select 1 from public.children c
      where c.id::text = split_part(storage.objects.name, '/', 1)
        and c.family_id = public.get_my_family_id()
    )
  );
