-- 20260426_002_avatars_bucket_no_listing.sql
-- APPLIED TO PRODUCTION 2026-06-11 (as `avatars_bucket_no_listing`).
--
-- The `avatars` bucket is public, which is fine because we serve avatar URLs
-- via getPublicUrl (the CDN does not consult storage.objects RLS). But the
-- old policies granted SELECT to {public} and INSERT/UPDATE to any
-- authenticated user with only a bucket check — allowing full listing of the
-- bucket and overwriting any other user's avatar files.
--
-- This migration:
--   * Removes all anon access (no listing).
--   * Scopes authenticated SELECT/INSERT/UPDATE to:
--       members/<member_id>.<ext>  — only the owner of that family_members row
--       children/<child_id>.<ext>  — only if the child belongs to the caller's
--                                    family, or the child row doesn't exist yet
--                                    (SetupPage uploads the photo before the
--                                    children row is inserted).
--   * Keeps a scoped SELECT policy (instead of dropping SELECT entirely) so
--     `upload(..., { upsert: true })` re-uploads keep working.
--
-- Path parsing: split_part(name, '/', 2) grabs the basename `<id>.<ext>`,
-- the second split_part strips the extension. (storage.foldername returns
-- only the folder portion, NOT the basename — see earlier revision note.)

begin;

drop policy if exists "Anyone can read avatars" on storage.objects;
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Authenticated users can update avatars" on storage.objects;

create policy "Avatars read own family"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (
        split_part(name, '/', 1) = 'members'
        and exists (
          select 1 from public.family_members fm
          where fm.auth_user_id = (select auth.uid())
            and split_part(split_part(name, '/', 2), '.', 1) = fm.id::text
        )
      )
      or (
        split_part(name, '/', 1) = 'children'
        and (
          not exists (
            select 1 from public.children c
            where c.id::text = split_part(split_part(name, '/', 2), '.', 1)
          )
          or exists (
            select 1 from public.children c
            where c.id::text = split_part(split_part(name, '/', 2), '.', 1)
              and c.family_id = public.get_my_family_id()
          )
        )
      )
    )
  );

create policy "Avatars write own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (
        split_part(name, '/', 1) = 'members'
        and exists (
          select 1 from public.family_members fm
          where fm.auth_user_id = (select auth.uid())
            and split_part(split_part(name, '/', 2), '.', 1) = fm.id::text
        )
      )
      or (
        split_part(name, '/', 1) = 'children'
        and (
          not exists (
            select 1 from public.children c
            where c.id::text = split_part(split_part(name, '/', 2), '.', 1)
          )
          or exists (
            select 1 from public.children c
            where c.id::text = split_part(split_part(name, '/', 2), '.', 1)
              and c.family_id = public.get_my_family_id()
          )
        )
      )
    )
  );

create policy "Avatars update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (
        split_part(name, '/', 1) = 'members'
        and exists (
          select 1 from public.family_members fm
          where fm.auth_user_id = (select auth.uid())
            and split_part(split_part(name, '/', 2), '.', 1) = fm.id::text
        )
      )
      or (
        split_part(name, '/', 1) = 'children'
        and (
          not exists (
            select 1 from public.children c
            where c.id::text = split_part(split_part(name, '/', 2), '.', 1)
          )
          or exists (
            select 1 from public.children c
            where c.id::text = split_part(split_part(name, '/', 2), '.', 1)
              and c.family_id = public.get_my_family_id()
          )
        )
      )
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      (
        split_part(name, '/', 1) = 'members'
        and exists (
          select 1 from public.family_members fm
          where fm.auth_user_id = (select auth.uid())
            and split_part(split_part(name, '/', 2), '.', 1) = fm.id::text
        )
      )
      or (
        split_part(name, '/', 1) = 'children'
        and (
          not exists (
            select 1 from public.children c
            where c.id::text = split_part(split_part(name, '/', 2), '.', 1)
          )
          or exists (
            select 1 from public.children c
            where c.id::text = split_part(split_part(name, '/', 2), '.', 1)
              and c.family_id = public.get_my_family_id()
          )
        )
      )
    )
  );

commit;
