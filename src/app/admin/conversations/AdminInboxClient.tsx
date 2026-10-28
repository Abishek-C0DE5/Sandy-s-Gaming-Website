'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { MessageSquare, Clock, ArrowRight, Search, Filter } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ConversationStatus } from '@/types/database';

export interface InboxConversationItem {
  id: string;
  subject: string | null;
  status: ConversationStatus;
  last_message_at: string;
  created_at: string;
  customer?: {
    id: string;
    display_name: string;
    role: string;
  } | null;
}

interface AdminInboxClientProps {
  initialConversations: InboxConversationItem[];
  userRole: string;
}

export function AdminInboxClient({ initialConversations, userRole }: AdminInboxClientProps) {
  const [conversations] = useState<InboxConversationItem[]>(initialConversations);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ConversationStatus>('all');

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Status filter
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const customerName = c.customer?.display_name?.toLowerCase() || '';
        const subject = c.subject?.toLowerCase() || '';
        const id = c.id.toLowerCase();
        return customerName.includes(query) || subject.includes(query) || id.includes(query);
      }

      return true;
    });
  }, [conversations, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {userRole === 'super_admin' ? 'All Live Chat Conversations' : 'Assigned Live Chats'}
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            {userRole === 'super_admin'
              ? 'Global oversight across all customer live chat threads with multi-admin assignments.'
              : 'Support conversations actively assigned to your specialist queue.'}
          </p>
        </div>

        {userRole === 'super_admin' && (
          <Link
            href="/super-admin/assignments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 transition-colors shadow-2xs self-start sm:self-auto"
          >
            <span>Assignments Hub</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, subject, or thread ID..."
            className="w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-4 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-3.5 w-3.5 text-neutral-400 shrink-0 ml-1 hidden sm:block" />
          {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors shrink-0 ${
                statusFilter === st
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations Table / Empty State */}
      {filteredConversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={searchQuery || statusFilter !== 'all' ? 'No matching conversations' : 'No assigned conversations'}
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search criteria or resetting the status filter.'
              : userRole === 'super_admin'
              ? 'No customer conversations have been initiated yet.'
              : 'Your support queue is currently clear. Conversations will appear here once assigned to you.'
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
                  <th className="px-6 py-3 font-semibold">Last Activity</th>
                  <th className="px-6 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredConversations.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
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
                    <td className="px-6 py-4 text-neutral-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(c.last_message_at || c.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/conversations/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition-colors"
                      >
                        <span>Open Thread</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
