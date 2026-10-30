'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { MessageSquare, BookOpen, Image as ImageIcon, Mail, Shield, Menu, X, LogOut, User, LogIn } from 'lucide-react';

const NAV_LINKS = [
  { href: '/blog', label: 'Blogs', icon: BookOpen },
  { href: '/posts', label: 'Gallery', icon: ImageIcon },
  { href: '/contact', label: 'Contact', icon: Mail },
] as const;

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Detect scroll for glass effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserEmail(user.email || null);

          // Fetch profile role
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profile) {
            setUserRole(profile.role);
          }
        } else {
          setUserEmail(null);
          setUserRole(null);
        }
      } catch {
        // Fallback gracefully on network error
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    // Listen to Supabase auth state change events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null);
        loadUser();
      } else {
        setUserEmail(null);
        setUserRole(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUserEmail(null);
    setUserRole(null);
    router.push('/');
    router.refresh();
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const chatHref = userRole === 'admin' || userRole === 'super_admin' ? '/admin/conversations' : '/chat';
  const chatLabel = userRole === 'admin' || userRole === 'super_admin' ? 'Admin Inbox' : 'Live Chat';

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-500 ${
        scrolled
          ? 'bg-[var(--background)]/90 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_1px_20px_rgba(0,0,0,0.3)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="w-full flex h-16 max-w-[1920px] 2xl:max-w-none mx-auto items-center justify-between px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <BrandLogo size="md" withText={true} href="/" glow={false} />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                isActive(href)
                  ? 'text-white bg-white/[0.06]'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`h-4 w-4 transition-colors ${isActive(href) ? 'text-[var(--brand-primary)]' : ''}`} />
              <span>{label}</span>
              {isActive(href) && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[var(--brand-primary)]" />
              )}
            </Link>
          ))}
          <Link
            href={chatHref}
            className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
              isActive('/chat') || isActive('/admin/conversations')
                ? 'text-white bg-white/[0.06]'
                : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <MessageSquare className={`h-4 w-4 transition-colors ${isActive('/chat') || isActive('/admin/conversations') ? 'text-[var(--brand-primary)]' : ''}`} />
            <span>{chatLabel}</span>
          </Link>
        </nav>

        {/* Action Controls */}
        <div className="hidden md:flex items-center gap-2.5">
          {!loading && userEmail ? (
            <div className="flex items-center gap-2.5">
              {(userRole === 'admin' || userRole === 'super_admin') && (
                <>
                  <Link
                    href="/admin/posts/new"
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
                  >
                    <span>+ Post</span>
                  </Link>
                  <Link
                    href={userRole === 'super_admin' ? '/super-admin' : '/admin'}
                    className="btn-primary flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>{userRole === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
                  </Link>
                </>
              )}
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] glass rounded-xl px-2.5 py-1.5">
                <User className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                <span className="max-w-[120px] truncate">{userEmail}</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-xl border border-red-900/30 bg-red-950/10 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/20 hover:border-red-900/50 transition-all duration-300"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="btn-ghost flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
              >
                <LogIn className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/register"
                className="btn-ghost flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
              >
                <span>Register</span>
              </Link>
              <Link
                href="/admin"
                className="btn-primary flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Staff</span>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-xl p-2 text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.06] transition-all duration-300"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu — smooth slide-in */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-400 ease-out ${
          mobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-white/[0.06] bg-[var(--background)]/95 backdrop-blur-2xl px-4 pt-3 pb-5">
          <div className="flex flex-col space-y-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive(href)
                    ? 'text-white bg-white/[0.06]'
                    : 'text-[var(--text-primary)] hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive(href) ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'}`} />
                <span>{label}</span>
              </Link>
            ))}
            <Link
              href="/chat"
              className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                isActive('/chat')
                  ? 'text-white bg-white/[0.06]'
                  : 'text-[var(--text-primary)] hover:bg-white/[0.04]'
              }`}
            >
              <MessageSquare className={`h-4 w-4 ${isActive('/chat') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'}`} />
              <span>Live Chat</span>
            </Link>

            <div className="pt-3 mt-2 border-t border-white/[0.06] flex flex-col gap-2">
              {!loading && userEmail ? (
                <>
                  <div className="text-xs text-[var(--text-secondary)] py-1.5 px-3 font-mono">
                    {userEmail}
                    <span className="ml-1.5 text-[var(--text-muted)]">({userRole})</span>
                  </div>
                  {(userRole === 'admin' || userRole === 'super_admin') && (
                    <>
                      <Link
                        href="/admin/posts/new"
                        className="w-full text-center rounded-xl btn-ghost py-2.5 text-sm font-semibold text-[var(--text-primary)]"
                      >
                        + Create New Post
                      </Link>
                      <Link
                        href={userRole === 'super_admin' ? '/super-admin' : '/admin'}
                        className="w-full text-center rounded-xl btn-primary py-2.5 text-sm font-semibold text-white"
                      >
                        Staff Dashboard
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-center rounded-xl border border-red-900/30 bg-red-950/10 py-2.5 text-sm font-medium text-red-400 hover:bg-red-950/20 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="w-full text-center rounded-xl btn-ghost py-2.5 text-sm font-semibold text-[var(--text-primary)]"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/admin"
                    className="w-full text-center rounded-xl btn-primary py-2.5 text-sm font-semibold text-white"
                  >
                    Staff Portal
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
