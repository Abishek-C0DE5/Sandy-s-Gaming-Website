-- ==============================================================================
-- Migration 009: Storage Buckets & Row Level Security Policies
-- ==============================================================================

-- 1. Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Staff Upload Policy: Only Admins and Super Admins can upload objects to media buckets
DROP POLICY IF EXISTS "storage_staff_upload" ON storage.objects;
CREATE POLICY "storage_staff_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('public-media', 'draft-media')
    AND public.get_auth_role() IN ('admin', 'super_admin')
  );

-- 3. Staff Update Policy: Only Admins and Super Admins can update/replace stored media
DROP POLICY IF EXISTS "storage_staff_update" ON storage.objects;
CREATE POLICY "storage_staff_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('public-media', 'draft-media')
    AND public.get_auth_role() IN ('admin', 'super_admin')
  )
  WITH CHECK (
    bucket_id IN ('public-media', 'draft-media')
    AND public.get_auth_role() IN ('admin', 'super_admin')
  );

-- 4. Staff Delete Policy: Only Admins and Super Admins can remove objects from media buckets
DROP POLICY IF EXISTS "storage_staff_delete" ON storage.objects;
CREATE POLICY "storage_staff_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('public-media', 'draft-media')
    AND public.get_auth_role() IN ('admin', 'super_admin')
  );

-- 5. Public Media Read Policy: Anyone (anon or authenticated) can read objects in public-media
DROP POLICY IF EXISTS "storage_public_media_read" ON storage.objects;
CREATE POLICY "storage_public_media_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'public-media');

-- 6. Draft Media Read Policy: ONLY Staff can read from draft-media
DROP POLICY IF EXISTS "storage_draft_media_staff_read" ON storage.objects;
CREATE POLICY "storage_draft_media_staff_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'draft-media'
    AND public.get_auth_role() IN ('admin', 'super_admin')
  );
