'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { MessageSquare, BookOpen, Image as ImageIcon, Mail, Shield, Menu, X, LogOut, User, LogIn } from 'lucide-react';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#080809]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Official Brand Logo */}
        <div className="flex items-center gap-3">
          <BrandLogo size="md" withText={true} href="/" glow={true} />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#A5A5AD]">
          <Link
            href="/blog"
            className="flex items-center gap-1.5 hover:text-white hover:text-[#D71932] transition-colors"
          >
            <BookOpen className="h-4 w-4 text-[#D71932]" />
            <span>Blogs</span>
          </Link>
          <Link
            href="/posts"
            className="flex items-center gap-1.5 hover:text-white hover:text-[#D71932] transition-colors"
          >
            <ImageIcon className="h-4 w-4 text-[#D71932]" />
            <span>Gallery</span>
          </Link>
          <Link
            href="/contact"
            className="flex items-center gap-1.5 hover:text-white hover:text-[#D71932] transition-colors"
          >
            <Mail className="h-4 w-4 text-[#D71932]" />
            <span>Contact Us</span>
          </Link>
          <Link
            href={userRole === 'admin' || userRole === 'super_admin' ? '/admin/conversations' : '/chat'}
            className="flex items-center gap-1.5 hover:text-white hover:text-[#D71932] transition-colors"
          >
            <MessageSquare className="h-4 w-4 text-[#D71932]" />
            <span>{userRole === 'admin' || userRole === 'super_admin' ? 'Admin Inbox' : 'Live Chat'}</span>
          </Link>
        </nav>

        {/* Action Controls */}
        <div className="hidden md:flex items-center gap-3">
          {!loading && userEmail ? (
            <div className="flex items-center gap-3">
              {(userRole === 'admin' || userRole === 'super_admin') && (
                <>
                  <Link
                    href="/admin/posts/new"
                    className="flex items-center gap-1.5 rounded-lg border border-[#D71932]/50 bg-[#171719] px-3 py-1.5 text-xs font-bold text-[#F7F7F8] hover:border-[#D71932] hover:bg-[#D71932]/10 transition-colors"
                  >
                    <span>+ Post</span>
                  </Link>
                  <Link
                    href={userRole === 'super_admin' ? '/super-admin' : '/admin'}
                    className="flex items-center gap-1.5 rounded-lg bg-[#D71932] px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(215,25,50,0.4)] hover:bg-[#b01328] transition-colors"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>{userRole === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
                  </Link>
                </>
              )}
              <div className="flex items-center gap-1.5 text-xs text-[#A5A5AD] bg-[#101012] border border-white/[0.08] rounded-lg px-2.5 py-1.5">
                <User className="h-3.5 w-3.5 text-[#D71932]" />
                <span className="max-w-[120px] truncate">{userEmail}</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1 rounded-lg border border-red-950/60 bg-red-950/20 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#101012] px-3 py-1.5 text-xs font-semibold text-[#F7F7F8] hover:border-[#D71932]/50 hover:bg-[#171719] transition-colors"
              >
                <LogIn className="h-3.5 w-3.5 text-[#D71932]" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded-lg border border-[#D71932]/40 bg-[#171719] px-3 py-1.5 text-xs font-bold text-[#F7F7F8] hover:border-[#D71932] transition-colors"
              >
                <span>Register</span>
              </Link>
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-lg bg-[#D71932] px-3 py-1.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(215,25,50,0.4)] hover:bg-[#b01328] transition-colors"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Staff</span>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-[#A5A5AD] hover:text-white hover:bg-[#171719]"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-white/[0.08] bg-[#080809] px-4 pt-3 pb-5 md:hidden">
          <div className="flex flex-col space-y-3 text-sm font-medium">
            <Link
              href="/blog"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 py-1.5 text-[#F7F7F8] hover:text-[#D71932]"
            >
              <BookOpen className="h-4 w-4 text-[#D71932]" />
              <span>Blogs</span>
            </Link>
            <Link
              href="/posts"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 py-1.5 text-[#F7F7F8] hover:text-[#D71932]"
            >
              <ImageIcon className="h-4 w-4 text-[#D71932]" />
              <span>Gallery</span>
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 py-1.5 text-[#F7F7F8] hover:text-[#D71932]"
            >
              <Mail className="h-4 w-4 text-[#D71932]" />
              <span>Contact Us</span>
            </Link>
            <Link
              href="/chat"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 py-1.5 text-[#F7F7F8] hover:text-[#D71932]"
            >
              <MessageSquare className="h-4 w-4 text-[#D71932]" />
              <span>Live Chat</span>
            </Link>
            <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2">
              {!loading && userEmail ? (
                <>
                  <div className="text-xs text-[#A5A5AD] py-1 font-mono">
                    Signed in: {userEmail} ({userRole})
                  </div>
                  {(userRole === 'admin' || userRole === 'super_admin') && (
                    <>
                      <Link
                        href="/admin/posts/new"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full text-center rounded-lg border border-[#D71932]/50 bg-[#171719] py-2 text-sm font-bold text-[#F7F7F8] hover:border-[#D71932]"
                      >
                        + Create New Post
                      </Link>
                      <Link
                        href={userRole === 'super_admin' ? '/super-admin' : '/admin'}
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full text-center rounded-lg bg-[#D71932] py-2 text-sm font-bold text-white shadow-xs"
                      >
                        Staff Dashboard
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="w-full text-center rounded-lg border border-red-900/60 bg-red-950/20 py-2 text-sm font-medium text-red-400"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center rounded-lg border border-white/[0.12] bg-[#101012] py-2 text-sm font-semibold text-[#F7F7F8]"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center rounded-lg bg-[#D71932] py-2 text-sm font-bold text-white"
                  >
                    Staff Portal
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
