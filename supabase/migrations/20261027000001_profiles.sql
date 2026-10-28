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
