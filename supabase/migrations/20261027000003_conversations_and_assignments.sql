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
