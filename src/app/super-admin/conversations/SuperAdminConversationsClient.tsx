'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { MessageSquare, ArrowRight, Search, Filter, ShieldCheck, UserCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export interface SuperAdminConversationItem {
  id: string;
  subject: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
  customer?: { id: string; display_name: string; role: string } | null;
  assignments?: {
    id: string;
    status: string;
    admin?: { id: string; display_name: string } | null;
  }[] | null;
}

interface SuperAdminConversationsClientProps {
  initialConversations: SuperAdminConversationItem[];
}

export function SuperAdminConversationsClient({
  initialConversations,
}: SuperAdminConversationsClientProps) {
  const [conversations] = useState<SuperAdminConversationItem[]>(initialConversations);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Status filter
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      const activeAssignments = (c.assignments || []).filter((a) => a.status === 'active');

      // Assignment filter
      if (assignmentFilter === 'assigned' && activeAssignments.length === 0) {
        return false;
      }
      if (assignmentFilter === 'unassigned' && activeAssignments.length > 0) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const customerName = c.customer?.display_name?.toLowerCase() || '';
        const subject = c.subject?.toLowerCase() || '';
        const id = c.id.toLowerCase();
        const staffNames = activeAssignments.map((a) => a.admin?.display_name?.toLowerCase() || '').join(' ');

        return customerName.includes(query) || subject.includes(query) || id.includes(query) || staffNames.includes(query);
      }

      return true;
    });
  }, [conversations, statusFilter, assignmentFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
            System-Wide Conversations
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Global oversight across all customer live support channels. Super Admins can monitor, reply, and assign specialists.
          </p>
        </div>

        <Link
          href="/super-admin/assignments"
          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <UserCheck className="h-4 w-4" />
          <span>Manage Team Assignments</span>
        </Link>
      </div>

      {/* Controls Bar: Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, subject, ID, or specialist..."
            className="w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-4 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-purple-500 focus:outline-hidden focus:ring-1 focus:ring-purple-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Select */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl dark:bg-neutral-800 text-xs font-medium">
            <Filter className="h-3.5 w-3.5 text-neutral-400 ml-1.5" />
            {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-white text-neutral-900 shadow-2xs dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Assignment Coverage Filter */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl dark:bg-neutral-800 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-400 ml-1.5" />
            {(['all', 'assigned', 'unassigned'] as const).map((af) => (
              <button
                key={af}
                type="button"
                onClick={() => setAssignmentFilter(af)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  assignmentFilter === af
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300'
                }`}
              >
                {af}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table / Empty State */}
      {filteredConversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={searchQuery || statusFilter !== 'all' || assignmentFilter !== 'all' ? 'No matching conversations' : 'No customer conversations'}
          description={
            searchQuery || statusFilter !== 'all' || assignmentFilter !== 'all'
              ? 'Try clearing your search terms or relaxing filter options.'
              : 'Customer support threads will appear here once registered customers initiate live chat from their portal.'
          }
        />
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800 text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Customer</th>
                  <th className="px-6 py-3 font-semibold">Subject</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Assigned Staff</th>
                  <th className="px-6 py-3 font-semibold">Last Message</th>
                  <th className="px-6 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredConversations.map((c) => {
                  const activeAssignments = (c.assignments || []).filter((a) => a.status === 'active');

                  return (
                    <tr key={c.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {c.customer?.display_name || 'Customer'}
                        </div>
                        <div className="text-[10px] font-mono text-neutral-400">
                          ID: {c.id.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-neutral-800 dark:text-neutral-200">
                        {c.subject || 'General Support'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            c.status === 'open'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                              : c.status === 'in_progress'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                              : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                          }`}
                        >
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {activeAssignments.length === 0 ? (
                          <span className="text-neutral-400 italic text-[11px]">Unassigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {activeAssignments.map((a) => (
                              <span
                                key={a.id}
                                className="inline-flex items-center rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                              >
                                {a.admin?.display_name || 'Admin'}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-neutral-500">
                        {new Date(c.last_message_at || c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/super-admin/assignments?conversation_id=${c.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
                            title="Manage Assignments"
                          >
                            <span>Assign</span>
                          </Link>
                          <Link
                            href={`/admin/conversations/${c.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 transition-colors"
                          >
                            <span>Open</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
