import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Database, UserRole } from '@/types/database';
import { redirect } from 'next/navigation';

export type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Retrieves the currently authenticated Supabase Auth user.
 * Memoized per request using React cache() to prevent redundant network calls.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

/**
 * Retrieves the application profile for the current authenticated user.
 * Memoized per request to eliminate duplicate database queries.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
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
});

/**
 * Enforces authentication. If unauthenticated, redirects to /login.
 */
export async function requireAuth(redirectTo: string = '/login') {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(redirectTo);
  }

  if (profile.account_status === 'suspended') {
    redirect('/suspended');
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect(redirectTo);
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
