import { requireRole } from '@/lib/auth';
import Link from 'next/link';
import {
  ShieldAlert,
  LayoutDashboard,
  Users,
  MessageSquare,
  ShieldCheck,
  FileText,
  Mail,
  History,
  Settings,
  ArrowLeft,
} from 'lucide-react';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(['super_admin'], '/super-admin');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Super Admin Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-purple-200 pb-4 dark:border-purple-900/50 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              <ShieldAlert className="mr-1 h-3.5 w-3.5" />
              Super Admin Console
            </span>
            <span className="text-xs text-neutral-500">
              {profile.display_name} ({profile.email})
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            System Administration &amp; Governance
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Staff Portal</span>
          </Link>

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

      {/* Primary Sub-Navigation Bar */}
      <div className="mt-4 border-b border-neutral-200 pb-2 dark:border-neutral-800 overflow-x-auto">
        <nav className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap min-w-max">
          <Link
            href="/super-admin"
            className="flex items-center gap-1.5 rounded-lg border border-purple-300 px-3 py-1.5 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Overview</span>
          </Link>
          <Link
            href="/super-admin/conversations"
            className="flex items-center gap-1.5 rounded-lg border border-purple-300 px-3 py-1.5 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Conversations</span>
          </Link>
          <Link
            href="/super-admin/assignments"
            className="flex items-center gap-1.5 rounded-lg border border-purple-300 px-3 py-1.5 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Assignments</span>
          </Link>
          <Link
            href="/super-admin/users"
            className="flex items-center gap-1.5 rounded-lg border border-purple-300 px-3 py-1.5 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Admin Management</span>
          </Link>
          <Link
            href="/admin/posts"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Posts</span>
          </Link>
          <Link
            href="/admin/contact-requests"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Contact Requests</span>
          </Link>
          <Link
            href="/super-admin/audit-logs"
            className="flex items-center gap-1.5 rounded-lg border border-purple-300 px-3 py-1.5 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
          >
            <History className="h-3.5 w-3.5" />
            <span>Audit Logs</span>
          </Link>
          <Link
            href="/super-admin/settings"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </Link>
        </nav>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
