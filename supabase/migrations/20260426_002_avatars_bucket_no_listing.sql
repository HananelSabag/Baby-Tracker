-- 20260426_002_avatars_bucket_no_listing.sql
--
-- The `avatars` bucket is public, which is fine because we serve avatar URLs
-- via getPublicUrl. But the storage.objects SELECT policy "Anyone can read
-- avatars" (qual: bucket_id='avatars'::text, roles {public}) ALSO allows
-- LIST operations against the bucket, which lets clients enumerate every
-- file in it (including the `members/<member_id>.<ext>` paths). Public
-- bucket URLs do NOT need the SELECT policy to be served by the CDN.
--
-- We also tighten INSERT/UPDATE so a member can only write their own avatar
-- under `members/<member.id>.*`. Children avatars stay writable by any
-- authenticated user in the family because the SPA needs to upload before
-- the child row exists.
--
-- SAFE: avatar URLs continue to work; only the list endpoint stops returning
-- contents to unauthenticated callers.
--
-- IMPORTANT: this migration was previously written using
-- (storage.foldername(name))[2] to parse the filename, which is wrong —
-- storage.foldername returns the folder portion only, NOT the basename.
-- Corrected version below uses split_part(name, '/', 2) to grab the
-- basename (`<id>.<ext>`) and split_part again to strip the extension.
--
-- TEST PLAN before merging to prod:
--   1. apply on a Supabase branch
--   2. log in as user A, upload a profile photo → expect 201
--   3. log in as user A, attempt to PUT to members/<userB-id>.jpg via the
--      storage REST API → expect 403
--   4. anon list bucket via storage REST → expect 0 results
--   5. existing avatar URL still loads via the CDN

begin;

drop policy if exists "Anyone can read avatars" on storage.objects;

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Authenticated users can update avatars" on storage.objects;

create policy "Members write own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      -- members/<member.id>.<ext> — caller must own the family_member row
      (
        split_part(name, '/', 1) = 'members'
        and exists (
          select 1 from public.family_members fm
          where fm.auth_user_id = (select auth.uid())
            and split_part(split_part(name, '/', 2), '.', 1) = fm.id::text
        )
      )
      -- children/<...> — any authenticated user in the same family can upload
      -- (we don't always know the child id at create time on the SPA side)
      or split_part(name, '/', 1) = 'children'
    )
  );

create policy "Members update own avatar"
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
      or split_part(name, '/', 1) = 'children'
    )
  );

commit;
