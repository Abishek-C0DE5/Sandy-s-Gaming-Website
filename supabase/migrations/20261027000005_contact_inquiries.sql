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
