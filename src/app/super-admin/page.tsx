import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Users, Shield, MessageSquare, History, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function SuperAdminDashboardPage() {
  await requireRole(['super_admin'], '/super-admin');
  const supabase = await createClient();

  // Query genuine database counts for Super Admin
  const { count: staffCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .in('role', ['admin', 'super_admin']);

  const { count: convCount } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true });

  const { count: assignCount } = await supabase
    .from('conversation_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: auditCount } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true });

  const totalStaff = staffCount ?? 0;
  const totalConversations = convCount ?? 0;
  const totalAssignments = assignCount ?? 0;
  const totalAuditEvents = auditCount ?? 0;

  return (
    <div className="space-y-8">
      {/* Super Admin Metric Cards (Real PostgreSQL counts) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Staff Accounts</span>
            <Users className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-neutral-900 dark:text-white">{totalStaff}</p>
          <p className="mt-1 text-xs text-neutral-500">Active Admins &amp; Super Admins</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Conversations</span>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-neutral-900 dark:text-white">{totalConversations}</p>
          <p className="mt-1 text-xs text-neutral-500">Total customer support channels</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Assignments</span>
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-neutral-900 dark:text-white">{totalAssignments}</p>
          <p className="mt-1 text-xs text-neutral-500">Active conversation coverage</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Audit Events</span>
            <History className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-neutral-900 dark:text-white">{totalAuditEvents}</p>
          <p className="mt-1 text-xs text-neutral-500">Immutable security audit entries</p>
        </div>
      </div>

      {/* Governance Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Admin Management</h2>
              <p className="text-xs text-neutral-500">Provision and manage staff specialists</p>
            </div>
            <Link
              href="/super-admin/users"
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Manage Staff</span>
            </Link>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Public registration strictly defaults to the <code className="font-mono text-blue-600">customer</code> role. Privileged roles are granted exclusively through administrative procedures and database triggers.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-1">Live Chat Governance</h2>
          <p className="text-xs text-neutral-500 mb-4">Multi-admin assignment oversight</p>
          {totalConversations === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No customer threads created yet"
              description="Customer conversations will appear here once initiated. As Super Admin, you can assign multiple admins and monitor threads in real time."
            />
          ) : (
            <p className="text-xs text-neutral-600">Managing {totalConversations} active customer conversation(s).</p>
          )}
        </div>
      </div>
    </div>
  );
}
