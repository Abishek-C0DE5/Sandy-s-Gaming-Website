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
