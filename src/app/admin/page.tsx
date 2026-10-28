import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Inbox, Mail, BookOpen, Clock, CheckCircle } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AdminDashboardPage() {
  const profile = await requireRole(['admin', 'super_admin'], '/admin');
  const supabase = await createClient();

  // Query genuine database counts for authorized admin
  const { count: assignedCount } = await supabase
    .from('conversation_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('admin_id', profile.id)
    .eq('status', 'active');

  const { count: pendingInquiries } = await supabase
    .from('contact_inquiries')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');

  const { count: postsCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true });

  const totalAssigned = assignedCount ?? 0;
  const totalInquiries = pendingInquiries ?? 0;
  const totalPosts = postsCount ?? 0;

  return (
    <div className="space-y-8">
      {/* Overview Metric Cards (Backed by real database queries) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Assigned Chats</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Inbox className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {totalAssigned}
          </p>
          <p className="mt-1 text-xs text-neutral-500">Active conversations assigned to your queue</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Pending Inquiries</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Mail className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {totalInquiries}
          </p>
          <p className="mt-1 text-xs text-neutral-500">Unresolved guest contact submissions</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">CMS Articles</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {totalPosts}
          </p>
          <p className="mt-1 text-xs text-neutral-500">Database published and draft posts</p>
        </div>
      </div>

      {/* Operational Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
            Assigned Live Chats (Shared Model)
          </h2>
          <p className="text-xs text-neutral-500 mb-6">
            Real-time chat threads currently assigned to your specialist queue. Multiple admins can participate simultaneously.
          </p>
          {totalAssigned === 0 ? (
            <EmptyState
              icon={Clock}
              title="No chats currently assigned"
              description="Your support queue is clear. New conversations will appear here once assigned by a Super Admin."
            />
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                You have {totalAssigned} active conversation(s) assigned to your queue.
              </p>
              <Link
                href="/admin/conversations"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                <span>Open Support Queue</span>
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">
            Guest Contact Requests
          </h2>
          <p className="text-xs text-neutral-500 mb-6">
            Submissions received from the public Contact Us form for staff triage and email response.
          </p>
          {totalInquiries === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="All inquiries resolved"
              description="No unresolved guest messages in the queue. New submissions will populate here for review."
            />
          ) : (
            <p className="text-xs text-neutral-600">You have {totalInquiries} pending inquiry request(s).</p>
          )}
        </div>
      </div>
    </div>
  );
}
