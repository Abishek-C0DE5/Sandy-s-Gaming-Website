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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-white/[0.08] pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[#D71932]/40 bg-[#171719] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-[#D71932] shadow-[0_0_10px_rgba(215,25,50,0.2)]">
              Staff Portal
            </span>
            <span className="text-xs font-mono text-[#A5A5AD]">
              {profile.display_name} ({profile.role.replace('_', ' ')})
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
            Operational Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-2 text-xs font-bold">
            <Link
              href="/admin/posts/new"
              className="flex items-center gap-1.5 rounded-lg bg-[#D71932] px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_0_12px_rgba(215,25,50,0.35)] hover:bg-[#b01328] transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>+ New Post</span>
            </Link>
            <Link
              href="/admin/posts"
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171719] px-3 py-1.5 text-[#A5A5AD] hover:border-[#D71932] hover:text-white transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>All Posts</span>
            </Link>
            <Link
              href="/admin/conversations"
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171719] px-3 py-1.5 text-[#A5A5AD] hover:border-[#D71932] hover:text-white transition-colors"
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>Inbox (Chats)</span>
            </Link>
            <Link
              href="/admin/contact-requests"
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171719] px-3 py-1.5 text-[#A5A5AD] hover:border-[#D71932] hover:text-white transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Contact Requests</span>
            </Link>
            {profile.role === 'super_admin' && (
              <Link
                href="/super-admin"
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-white hover:bg-purple-500 shadow-[0_0_12px_rgba(147,51,234,0.3)] transition-colors"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Super Admin</span>
              </Link>
            )}
          </nav>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-950/20 px-2.5 py-1.5 text-xs font-bold text-red-400 hover:bg-red-900/40 transition-colors"
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
