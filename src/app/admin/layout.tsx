import { requireRole } from '@/lib/auth';
import Link from 'next/link';
import { Shield, Inbox, Mail, FileText } from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(['admin', 'super_admin'], '/admin');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Admin Subheader Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Staff Portal
            </span>
            <span className="text-xs text-neutral-500">
              {profile.display_name} ({profile.role.replace('_', ' ')})
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Operational Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-2 text-xs font-medium">
            <Link
              href="/admin/conversations"
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>Inbox (Chats)</span>
            </Link>
            <Link
              href="/admin/contact-requests"
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Contact Requests</span>
            </Link>
            <Link
              href="/admin/posts"
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Posts</span>
            </Link>
            {profile.role === 'super_admin' && (
              <Link
                href="/super-admin"
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-white hover:bg-purple-500"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Super Admin</span>
              </Link>
            )}
          </nav>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-neutral-700 dark:hover:bg-red-950/30"
              title="Sign Out"
            >
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
