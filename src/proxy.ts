import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protected route checking:
  const isCustomerRoute = pathname.startsWith('/chat') || pathname.startsWith('/account');
  const isAdminRoute = pathname.startsWith('/admin');
  const isSuperAdminRoute = pathname.startsWith('/super-admin');

  if (isCustomerRoute || isAdminRoute || isSuperAdminRoute) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify profile, active account status, and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, account_status')
      .eq('id', user.id)
      .single();

    if (!profile) {
      // Handle missing profile safely
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'Profile not found. Please log in again.');
      return NextResponse.redirect(loginUrl);
    }

    if (profile.account_status === 'suspended') {
      return NextResponse.redirect(new URL('/suspended', request.url));
    }

    if (isSuperAdminRoute && profile.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    if (isAdminRoute && profile.role !== 'admin' && profile.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public asset extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
