-- ==============================================================================
-- Migration 008: Security Hardening & Strict Role Protection
-- ==============================================================================

-- 1. Database-Level Role Escalation Protection Trigger
-- Guarantees that neither customers nor admins can escalate their role,
-- regardless of RLS bypass attempts or client-side queries.
CREATE OR REPLACE FUNCTION public.protect_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role or account_status is being modified:
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.account_status IS DISTINCT FROM NEW.account_status) THEN
    -- Verify if the caller is super_admin or running via service role
    -- auth.uid() is NULL when running directly in service role or SQL editor
    IF (auth.uid() IS NOT NULL AND COALESCE(public.get_auth_role(), '') <> 'super_admin') THEN
      RAISE EXCEPTION 'Security Violation: Only Super Admins can alter user roles or account status.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role_escalation();

-- 2. Audit Table Immutable Protection Trigger
-- Explicitly forbids UPDATE or DELETE statements on audit_logs at the engine level
CREATE OR REPLACE FUNCTION public.protect_audit_logs_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Security Violation: audit_logs is append-only and cannot be modified or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_protect_audit_logs
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_audit_logs_immutability();

-- 3. Ensure Storage Bucket Policies Are Not Wide Open
-- Check and lock down default storage objects
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  END IF;
END;
$$;
