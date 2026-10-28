-- ==============================================================================
-- Migration 007: Row Level Security (RLS) & Access Policies
-- ==============================================================================

-- 1. Enable Row Level Security (RLS) across all application tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiry_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Revoke default public access and grant explicit privileges
REVOKE ALL ON public.profiles FROM PUBLIC, anon;
REVOKE ALL ON public.posts FROM PUBLIC;
REVOKE ALL ON public.post_media FROM PUBLIC;
REVOKE ALL ON public.conversations FROM PUBLIC, anon;
REVOKE ALL ON public.conversation_assignments FROM PUBLIC, anon;
REVOKE ALL ON public.messages FROM PUBLIC, anon;
REVOKE ALL ON public.contact_inquiries FROM PUBLIC;
REVOKE ALL ON public.contact_inquiry_replies FROM PUBLIC, anon;
REVOKE ALL ON public.audit_logs FROM PUBLIC, anon;

-- Public / Anonymous grants
GRANT SELECT ON public.posts TO anon;
GRANT SELECT ON public.post_media TO anon;
GRANT INSERT ON public.contact_inquiries TO anon;

-- Authenticated user grants
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.posts TO authenticated;
GRANT SELECT ON public.post_media TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_assignments TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT INSERT ON public.contact_inquiries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contact_inquiries TO authenticated;
GRANT SELECT, INSERT ON public.contact_inquiry_replies TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

-- Staff role grants for content management
GRANT ALL ON public.posts TO authenticated;
GRANT ALL ON public.post_media TO authenticated;
GRANT ALL ON public.conversation_assignments TO authenticated;

-- ==============================================================================
-- 3. Row Level Security Policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "profiles_select_self_or_staff"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR public.get_auth_role() IN ('admin', 'super_admin')
  );

-- Users can update their own profile, but CANNOT modify their role or account status
CREATE POLICY "profiles_update_self_safe"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() 
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND account_status = (SELECT p.account_status FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Super Admin can manage all profiles and assign roles
CREATE POLICY "profiles_super_admin_all"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.get_auth_role() = 'super_admin')
  WITH CHECK (public.get_auth_role() = 'super_admin');

-- ------------------------------------------------------------------------------
-- POSTS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "posts_select_published"
  ON public.posts FOR SELECT
  TO anon, authenticated
  USING (
    (status = 'published' AND (published_at IS NULL OR published_at <= timezone('utc', now())))
    OR (auth.uid() IS NOT NULL AND public.get_auth_role() IN ('admin', 'super_admin'))
  );

CREATE POLICY "posts_staff_write"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

CREATE POLICY "posts_staff_update"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

CREATE POLICY "posts_staff_delete"
  ON public.posts FOR DELETE
  TO authenticated
  USING (public.get_auth_role() = 'super_admin' OR (author_id = auth.uid() AND public.get_auth_role() = 'admin'));

-- ------------------------------------------------------------------------------
-- POST_MEDIA POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "post_media_select"
  ON public.post_media FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts 
      WHERE posts.id = post_media.post_id 
        AND (
          (posts.status = 'published' AND (posts.published_at IS NULL OR posts.published_at <= timezone('utc', now())))
          OR (auth.uid() IS NOT NULL AND public.get_auth_role() IN ('admin', 'super_admin'))
        )
    )
  );

CREATE POLICY "post_media_staff_write"
  ON public.post_media FOR ALL
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

-- ------------------------------------------------------------------------------
-- CONVERSATIONS POLICIES (Shared Multi-Admin Support)
-- ------------------------------------------------------------------------------
CREATE POLICY "conversations_select"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid() 
    OR public.is_assigned_to_conversation(id) 
    OR public.get_auth_role() = 'super_admin'
  );

CREATE POLICY "conversations_insert_customer"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "conversations_update"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid() 
    OR public.is_assigned_to_conversation(id) 
    OR public.get_auth_role() = 'super_admin'
  )
  WITH CHECK (
    customer_id = auth.uid() 
    OR public.is_assigned_to_conversation(id) 
    OR public.get_auth_role() = 'super_admin'
  );

CREATE POLICY "conversations_delete_super_admin"
  ON public.conversations FOR DELETE
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

-- ------------------------------------------------------------------------------
-- CONVERSATION_ASSIGNMENTS POLICIES (Staff Assignment Controls)
-- ------------------------------------------------------------------------------
-- Notice: Customers have ZERO SELECT access on this table, protecting staff identity
CREATE POLICY "assignments_select_assigned_or_super_admin"
  ON public.conversation_assignments FOR SELECT
  TO authenticated
  USING (
    admin_id = auth.uid() 
    OR public.get_auth_role() = 'super_admin'
  );

CREATE POLICY "assignments_super_admin_manage"
  ON public.conversation_assignments FOR ALL
  TO authenticated
  USING (public.get_auth_role() = 'super_admin')
  WITH CHECK (public.get_auth_role() = 'super_admin');

-- ------------------------------------------------------------------------------
-- MESSAGES POLICIES (True Sender ID Retained)
-- ------------------------------------------------------------------------------
CREATE POLICY "messages_select"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = auth.uid())
    OR public.is_assigned_to_conversation(conversation_id)
    OR public.get_auth_role() = 'super_admin'
  );

CREATE POLICY "messages_insert"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() 
    AND (
      conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = auth.uid())
      OR public.is_assigned_to_conversation(conversation_id)
      OR public.get_auth_role() = 'super_admin'
    )
  );

CREATE POLICY "messages_super_admin_delete"
  ON public.messages FOR DELETE
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

-- ------------------------------------------------------------------------------
-- CONTACT_INQUIRIES POLICIES (Guest Form - Isolated from Live Chat)
-- ------------------------------------------------------------------------------
-- Public visitors can submit, but have ZERO SELECT access (prevents enumeration)
CREATE POLICY "contact_inquiries_insert_public"
  ON public.contact_inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "contact_inquiries_staff_select"
  ON public.contact_inquiries FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'));

CREATE POLICY "contact_inquiries_staff_update"
  ON public.contact_inquiries FOR UPDATE
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

CREATE POLICY "contact_inquiries_super_admin_delete"
  ON public.contact_inquiries FOR DELETE
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

-- ------------------------------------------------------------------------------
-- CONTACT_INQUIRY_REPLIES POLICIES (Staff Email Replies)
-- ------------------------------------------------------------------------------
CREATE POLICY "inquiry_replies_staff_select"
  ON public.contact_inquiry_replies FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'));

CREATE POLICY "inquiry_replies_staff_insert"
  ON public.contact_inquiry_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = auth.uid() 
    AND public.get_auth_role() IN ('admin', 'super_admin')
  );

-- ------------------------------------------------------------------------------
-- AUDIT_LOGS POLICIES (Immutable Audit Trail)
-- ------------------------------------------------------------------------------
CREATE POLICY "audit_logs_super_admin_select"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

CREATE POLICY "audit_logs_authenticated_insert"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- NOTE: No UPDATE or DELETE policies are created for audit_logs (append-only)

-- ==============================================================================
-- 4. Enable Realtime Publications for Live Chat
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- Supabase realtime publication not present in local test runner
END;
$$;
