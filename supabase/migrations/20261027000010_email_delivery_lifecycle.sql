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
