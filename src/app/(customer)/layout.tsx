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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Customer Header Shell */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-5 dark:border-neutral-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Customer Portal
            </span>
            <span className="text-xs text-neutral-500">
              {profile?.display_name || user.email}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Support &amp; Account Center
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-2">
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Live Chat</span>
            </Link>
            <Link
              href="/account"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              <User className="h-3.5 w-3.5" />
              <span>My Account</span>
            </Link>
          </nav>

          {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 transition-colors"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Staff Portal</span>
            </Link>
          )}

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-neutral-700 dark:hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
