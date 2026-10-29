import { requireAuth, getCurrentProfile } from '@/lib/auth';
import Link from 'next/link';
import { MessageSquare, User, LogOut, Shield } from 'lucide-react';

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth('/login?redirect=/chat');
  const profile = await getCurrentProfile();

  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 py-8 sm:px-8 lg:px-12 xl:px-16">
      {/* Customer Header Shell */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full glass px-2.5 py-0.5 text-xs font-semibold text-[var(--brand-primary)]">
              Customer Portal
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {profile?.display_name || user.email}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">
            Support &amp; Account Center
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <nav className="flex items-center gap-1.5">
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-white/[0.15] hover:bg-white/[0.08] transition-all duration-300"
            >
              <MessageSquare className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>Live Chat</span>
            </Link>
            <Link
              href="/account"
              className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-white hover:border-white/[0.15] hover:bg-white/[0.08] transition-all duration-300"
            >
              <User className="h-3.5 w-3.5" />
              <span>My Account</span>
            </Link>
          </nav>

          {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
            <Link
              href="/admin"
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Staff Portal</span>
            </Link>
          )}

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl glass px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 hover:border-red-500/30 transition-all duration-300"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
