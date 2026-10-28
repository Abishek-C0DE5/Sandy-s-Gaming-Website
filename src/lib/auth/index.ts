import { createClient } from '@/lib/supabase/server';
import type { Database, UserRole } from '@/types/database';
import { redirect } from 'next/navigation';

export type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Retrieves the currently authenticated Supabase Auth user.
 * Returns null if no active session exists.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Retrieves the application profile for the current authenticated user.
 * Queries PostgreSQL profiles table directly to prevent JWT tampering.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return null;
  }

  return profile;
}

/**
 * Enforces authentication. If unauthenticated, redirects to /login.
 */
export async function requireAuth(redirectTo: string = '/login') {
  const user = await getCurrentUser();
  if (!user) {
    redirect(redirectTo);
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login?error=Profile%20not%20found');
  }

  if (profile.account_status === 'suspended') {
    redirect('/suspended');
  }

  return user;
}

/**
 * Enforces role authorization.
 * If user lacks the required role or account is suspended, redirects appropriately.
 */
export async function requireRole(allowedRoles: UserRole[], fallbackUrl: string = '/') {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/login?redirect=${encodeURIComponent(fallbackUrl)}`);
  }

  if (profile.account_status === 'suspended') {
    redirect('/suspended');
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect('/unauthorized');
  }

  return profile;
}
