-- ==============================================================================
-- Migration 011: Supabase Realtime Private Broadcast & Authorization Policies
-- ==============================================================================

-- 1. Enable RLS on realtime.messages (if not already enabled)
-- Note: In Supabase, RLS is typically enabled on realtime.messages by default.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 2. Clean up any existing policies
DROP POLICY IF EXISTS "realtime_conversation_select" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_conversation_insert" ON realtime.messages;

-- 3. Policy: Control who can LISTEN (SELECT) to private conversation topics
-- Topics follow the standard format: 'conversation:<conversation_id>'
CREATE POLICY "realtime_conversation_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND (
    -- Allow conversation topics
    realtime.topic() LIKE 'conversation:%'
    AND (
      -- A. Conversation owner (Customer)
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.customer_id = auth.uid()
          AND 'conversation:' || c.id::text = realtime.topic()
      )
      -- B. Actively assigned staff (Admin)
      OR EXISTS (
        SELECT 1 FROM public.conversation_assignments ca
        WHERE ca.admin_id = auth.uid()
          AND ca.status = 'active'
          AND 'conversation:' || ca.conversation_id::text = realtime.topic()
      )
      -- C. Super Administrator (Global visibility)
      OR public.get_auth_role() = 'super_admin'
    )
  )
);

-- 4. Policy: Control who can BROADCAST (INSERT) to private conversation topics
CREATE POLICY "realtime_conversation_insert"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.messages.extension = 'broadcast'
  AND realtime.topic() LIKE 'conversation:%'
  AND (
    -- Customer owner can broadcast typing/presence/message events
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.customer_id = auth.uid()
        AND 'conversation:' || c.id::text = realtime.topic()
    )
    -- Actively assigned staff can broadcast
    OR EXISTS (
      SELECT 1 FROM public.conversation_assignments ca
      WHERE ca.admin_id = auth.uid()
        AND ca.status = 'active'
        AND 'conversation:' || ca.conversation_id::text = realtime.topic()
    )
    -- Super Administrator can broadcast
    OR public.get_auth_role() = 'super_admin'
  )
);

-- 5. Database Trigger: Instant Realtime Broadcast on PostgreSQL Message Insertion
CREATE OR REPLACE FUNCTION public.broadcast_conversation_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
DECLARE
  v_sender_role TEXT;
  v_sender_name TEXT;
  v_payload JSONB;
BEGIN
  -- Retrieve sender profile metadata
  SELECT role, display_name INTO v_sender_role, v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Build minimal, sanitized broadcast payload
  -- Masks staff sender name to 'Support Team' for privacy while retaining true metadata for staff
  v_payload := json_build_object(
    'id', NEW.id,
    'conversation_id', NEW.conversation_id,
    'body', NEW.body,
    'message_type', NEW.message_type,
    'created_at', NEW.created_at,
    'sender_id', NEW.sender_id,
    'sender_role', COALESCE(v_sender_role, 'customer'),
    'sender_name', CASE 
      WHEN v_sender_role IN ('admin', 'super_admin') THEN 'Support Team' 
      ELSE COALESCE(v_sender_name, 'Customer') 
    END,
    'true_sender_name', COALESCE(v_sender_name, 'Staff Member')
  );

  -- Insert directly into realtime.messages for PostgreSQL-to-WebSocket broadcast
  BEGIN
    INSERT INTO realtime.messages (topic, extension, event, payload)
    VALUES (
      'conversation:' || NEW.conversation_id::text,
      'broadcast',
      'new_message',
      v_payload
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Safety shield: Never fail the base message insert transaction if realtime table has an issue
      NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_conversation_message ON public.messages;
CREATE TRIGGER trg_broadcast_conversation_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_conversation_message();
