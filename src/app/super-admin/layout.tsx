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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-white/[0.08] pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-purple-500/40 bg-purple-950/60 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
              <ShieldAlert className="mr-1 h-3.5 w-3.5" />
              Super Admin Console
            </span>
            <span className="text-xs font-mono text-[#A5A5AD]">
              {profile.display_name} ({profile.email})
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
            System Administration &amp; Governance
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171719] px-3.5 py-1.5 text-xs font-bold text-white hover:border-[#D71932] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Staff Portal</span>
          </Link>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg border border-[#D71932]/40 bg-[#171719] px-3 py-1.5 text-xs font-semibold text-[#D71932] hover:bg-[#D71932] hover:text-white transition-colors"
              title="Sign Out"
            >
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </div>

      {/* Primary Sub-Navigation Bar */}
      <div className="mt-4 border-b border-white/[0.08] pb-2 overflow-x-auto">
        <nav className="flex items-center gap-2 text-xs font-bold whitespace-nowrap min-w-max">
          <Link
            href="/super-admin"
            className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-[#171719] px-3 py-1.5 text-purple-300 hover:border-purple-500 hover:text-white transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Overview</span>
          </Link>
          <Link
            href="/super-admin/conversations"
            className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-[#171719] px-3 py-1.5 text-purple-300 hover:border-purple-500 hover:text-white transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Conversations</span>
          </Link>
          <Link
            href="/super-admin/assignments"
            className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-[#171719] px-3 py-1.5 text-purple-300 hover:border-purple-500 hover:text-white transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Assignments</span>
          </Link>
          <Link
            href="/super-admin/users"
            className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-[#171719] px-3 py-1.5 text-purple-300 hover:border-purple-500 hover:text-white transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Admin Management</span>
          </Link>
          <Link
            href="/admin/posts"
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171719] px-3 py-1.5 text-[#A5A5AD] hover:border-[#D71932] hover:text-white transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Posts</span>
          </Link>
          <Link
            href="/admin/contact-requests"
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171719] px-3 py-1.5 text-[#A5A5AD] hover:border-[#D71932] hover:text-white transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Contact Requests</span>
          </Link>
          <Link
            href="/super-admin/audit-logs"
            className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-[#171719] px-3 py-1.5 text-purple-300 hover:border-purple-500 hover:text-white transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            <span>Audit Logs</span>
          </Link>
          <Link
            href="/super-admin/settings"
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171719] px-3 py-1.5 text-[#A5A5AD] hover:border-[#D71932] hover:text-white transition-colors"
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
