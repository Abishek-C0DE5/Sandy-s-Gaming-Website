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
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
            {userRole === 'super_admin' ? 'All Live Chat Conversations' : 'Assigned Live Chats'}
          </h2>
          <p className="mt-1 text-xs text-[#A5A5AD]">
            {userRole === 'super_admin'
              ? 'Global oversight across all customer live chat threads with multi-admin assignments.'
              : 'Support conversations actively assigned to your specialist queue.'}
          </p>
        </div>

        {userRole === 'super_admin' && (
          <Link
            href="/super-admin/assignments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#171719] px-3.5 py-2 text-xs font-bold text-white hover:border-[#D71932] hover:text-[#D71932] transition-colors shadow-lg self-start sm:self-auto"
          >
            <span>Assignments Hub</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#A5A5AD]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, subject, or thread ID..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#171719] pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-[#64646D] focus:border-[#D71932] focus:outline-none focus:ring-1 focus:ring-[#D71932] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-3.5 w-3.5 text-[#A5A5AD] shrink-0 ml-1 hidden sm:block" />
          {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-[#D71932] text-white shadow-[0_0_12px_rgba(215,25,50,0.35)]'
                  : 'bg-[#171719] border border-white/[0.06] text-[#A5A5AD] hover:text-white hover:border-white/[0.12]'
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
        <div className="rounded-2xl border border-white/[0.08] bg-[#101012] shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-left text-xs">
              <thead className="bg-[#171719]/80 text-[#A5A5AD]">
                <tr>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider">Last Activity</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredConversations.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-sm">
                        {c.customer?.display_name || 'Customer'}
                      </div>
                      <div className="text-[10px] font-mono text-[#A5A5AD]">
                        ID: {c.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-[#F7F7F8]">
                      {c.subject || 'General Support'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          c.status === 'open'
                            ? 'bg-[#D71932]/15 text-[#D71932] border border-[#D71932]/30'
                            : c.status === 'in_progress'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-white/[0.06] text-[#A5A5AD] border border-white/[0.08]'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#A5A5AD]">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Clock className="h-3 w-3 text-[#D71932]" />
                        <span>{new Date(c.last_message_at || c.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/conversations/${c.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#D71932] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#b01328] shadow-[0_0_10px_rgba(215,25,50,0.3)] transition-colors"
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
