-- ==============================================================================
-- Migration 001: Profiles & Auth Integration
-- ==============================================================================

-- 1. Create utility trigger function for automatic updated_at maintenance
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- 2. Profiles Table: 1-to-1 linkage with Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  display_name TEXT NOT NULL DEFAULT 'User',
  role TEXT NOT NULL CHECK (role IN ('customer', 'admin', 'super_admin')) DEFAULT 'customer',
  account_status TEXT NOT NULL CHECK (account_status IN ('active', 'suspended', 'pending')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Index for role lookup performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Security Helper Function: get_auth_role()
-- STABLE and SECURITY DEFINER to prevent recursive RLS and search_path poisoning
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 4. Auth Sync Trigger: Automatically provisions profile on new auth.users signup
-- Public signup ALWAYS defaults to 'customer' role. Privileged roles require Super Admin promotion.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, display_name, role, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, 'User'), '@', 1)),
    'customer',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
-- ==============================================================================
-- Migration 002: Posts & Post Media
-- ==============================================================================

-- 1. Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  body TEXT,
  post_type TEXT NOT NULL CHECK (post_type IN ('blog', 'poster', 'photo')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  cover_image TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for public listing and slug resolution
CREATE INDEX IF NOT EXISTS idx_posts_type_status_published ON public.posts(post_type, status, published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_slug ON public.posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_posts_updated_at ON public.posts;
CREATE TRIGGER set_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Post Media Table (Normalized media assets for galleries and multiple images)
CREATE TABLE IF NOT EXISTS public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Index for ordering media assets per post
CREATE INDEX IF NOT EXISTS idx_post_media_post_sort ON public.post_media(post_id, sort_order ASC);
-- ==============================================================================
-- Migration 003: Conversations & Conversation Assignments
-- ==============================================================================

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT DEFAULT 'General Support',
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_conversations_customer ON public.conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Conversation Assignments Table
-- Implements the shared-conversation model (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.conversation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'removed')) DEFAULT 'active',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  removed_at TIMESTAMPTZ
);

-- Partial Unique Index: Guarantees that an admin cannot have duplicate ACTIVE assignments to the same conversation.
-- Historical records with status = 'removed' can coexist for complete auditability.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_assignment 
  ON public.conversation_assignments(conversation_id, admin_id) 
  WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS idx_assignments_admin ON public.conversation_assignments(admin_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_conv ON public.conversation_assignments(conversation_id, status);

-- 3. Security Helper Function: is_assigned_to_conversation()
-- Efficiently checks if current user is actively assigned to conversation (used in RLS)
CREATE OR REPLACE FUNCTION public.is_assigned_to_conversation(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.conversation_assignments
    WHERE conversation_id = conv_id
      AND admin_id = auth.uid()
      AND status = 'active'
  );
$$;
-- ==============================================================================
-- Migration 004: Messages & Conversation Last Message Trigger
-- ==============================================================================

-- 1. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 5000),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'system', 'media')) DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  edited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- 2. Trigger Function: Automatically updates conversation last_message_at on new message
CREATE OR REPLACE FUNCTION public.maintain_conversation_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    updated_at = timezone('utc', now())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.maintain_conversation_last_message_at();
-- ==============================================================================
-- Migration 005: Contact Inquiries & Replies (Guest Workflow - Isolated from Chat)
-- ==============================================================================

-- 1. Contact Inquiries Table (Guest form submissions)
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL CHECK (length(trim(message)) >= 10 AND length(message) <= 5000),
  status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'replied', 'closed')) DEFAULT 'new',
  assigned_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  replied_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON public.contact_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created ON public.contact_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_assigned ON public.contact_inquiries(assigned_admin_id);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_contact_inquiries_updated_at ON public.contact_inquiries;
CREATE TRIGGER set_contact_inquiries_updated_at
  BEFORE UPDATE ON public.contact_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Contact Inquiry Replies Table (Staff email responses)
CREATE TABLE IF NOT EXISTS public.contact_inquiry_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  email_delivery_status TEXT NOT NULL CHECK (email_delivery_status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  provider_message_id TEXT,
  last_delivery_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_inquiry_replies_inquiry ON public.contact_inquiry_replies(inquiry_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_inquiry_replies_admin ON public.contact_inquiry_replies(admin_id);

-- 3. Trigger Function: Updates inquiry status to 'replied' and records replied_at timestamp
CREATE OR REPLACE FUNCTION public.handle_inquiry_reply_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contact_inquiries
  SET 
    status = 'replied',
    replied_at = NEW.created_at,
    updated_at = timezone('utc', now())
  WHERE id = NEW.inquiry_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_inquiry_reply_created ON public.contact_inquiry_replies;
CREATE TRIGGER on_inquiry_reply_created
  AFTER INSERT ON public.contact_inquiry_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_inquiry_reply_created();
-- ==============================================================================
-- Migration 006: Audit Logs (Immutable Security Audit Trail)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
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

-- ==============================================================================
-- Migration 010: Email Delivery Lifecycle & Retry Mechanism
-- ==============================================================================

-- 1. Expand email_delivery_status check constraint to support granular provider states
ALTER TABLE public.contact_inquiry_replies 
  DROP CONSTRAINT IF EXISTS contact_inquiry_replies_email_delivery_status_check;

ALTER TABLE public.contact_inquiry_replies 
  ADD CONSTRAINT contact_inquiry_replies_email_delivery_status_check 
  CHECK (email_delivery_status IN ('pending', 'queued', 'accepted', 'sent', 'delivered', 'bounced', 'failed'));

-- 2. Add idempotency and retry columns to contact_inquiry_replies
ALTER TABLE public.contact_inquiry_replies
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ;

-- 3. Index for delivery status queries and retries
CREATE INDEX IF NOT EXISTS idx_inquiry_replies_status 
  ON public.contact_inquiry_replies(email_delivery_status);

CREATE INDEX IF NOT EXISTS idx_inquiry_replies_idempotency 
  ON public.contact_inquiry_replies(idempotency_key);


