'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  UserCheck,
  UserPlus,
  Trash2,
  Clock,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Shield,
  History,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export interface AdminUserOption {
  id: string;
  display_name: string;
  role: string;
}

export interface AssignmentHistoryRecord {
  id: string;
  conversation_id: string;
  admin_id: string;
  assigned_by: string | null;
  status: string;
  assigned_at: string;
  removed_at: string | null;
  admin?: { id: string; display_name: string; role: string } | null;
  assigner?: { id: string; display_name: string; role: string } | null;
}

export interface ConversationSummaryItem {
  id: string;
  subject: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
  customer?: { id: string; display_name: string; role: string } | null;
  assignments?: AssignmentHistoryRecord[] | null;
}

interface AssignmentsHubClientProps {
  initialConversations: ConversationSummaryItem[];
  availableAdmins: AdminUserOption[];
  preselectedConversationId?: string;
}

export function AssignmentsHubClient({
  initialConversations,
  availableAdmins,
  preselectedConversationId,
}: AssignmentsHubClientProps) {
  const [conversations, setConversations] = useState<ConversationSummaryItem[]>(initialConversations);
  const [selectedConvId, setSelectedConvId] = useState<string>(
    preselectedConversationId || initialConversations[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAdminToAssign, setSelectedAdminToAssign] = useState('');
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selected conversation
  const selectedConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConvId) || null;
  }, [conversations, selectedConvId]);

  // Active assignments for selected conversation
  const activeAssignments = useMemo(() => {
    if (!selectedConversation?.assignments) return [];
    return selectedConversation.assignments.filter((a) => a.status === 'active');
  }, [selectedConversation]);

  // Assignment history (removed or past assignments)
  const assignmentHistory = useMemo(() => {
    if (!selectedConversation?.assignments) return [];
    return selectedConversation.assignments
      .filter((a) => a.status === 'removed')
      .sort((a, b) => new Date(b.removed_at || b.assigned_at).getTime() - new Date(a.removed_at || a.assigned_at).getTime());
  }, [selectedConversation]);

  // Admins eligible to be assigned (active admins not currently assigned to this conversation)
  const assignableAdmins = useMemo(() => {
    const assignedAdminIds = new Set(activeAssignments.map((a) => a.admin_id));
    return availableAdmins.filter((a) => !assignedAdminIds.has(a.id));
  }, [availableAdmins, activeAssignments]);

  // Filter conversations in left pane
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const customer = c.customer?.display_name?.toLowerCase() || '';
        const subject = c.subject?.toLowerCase() || '';
        const id = c.id.toLowerCase();
        return customer.includes(query) || subject.includes(query) || id.includes(query);
      }
      return true;
    });
  }, [conversations, statusFilter, searchQuery]);

  // Handle assigning an admin
  const handleAssignAdmin = async () => {
    if (!selectedConvId || !selectedAdminToAssign || isMutating) return;
    setIsMutating(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/conversations/${selectedConvId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: selectedAdminToAssign }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign admin');
      }

      const assignedAdminInfo = availableAdmins.find((a) => a.id === selectedAdminToAssign);
      const newRecord: AssignmentHistoryRecord = {
        id: data.assignment.id,
        conversation_id: selectedConvId,
        admin_id: selectedAdminToAssign,
        assigned_by: data.assignment.assigned_by,
        status: 'active',
        assigned_at: data.assignment.assigned_at || new Date().toISOString(),
        removed_at: null,
        admin: assignedAdminInfo
          ? { id: assignedAdminInfo.id, display_name: assignedAdminInfo.display_name, role: assignedAdminInfo.role }
          : null,
      };

      // Update state
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConvId
            ? {
                ...c,
                assignments: [...(c.assignments || []), newRecord],
              }
            : c
        )
      );

      setSelectedAdminToAssign('');
      setFeedback({
        type: 'success',
        message: `Successfully assigned ${assignedAdminInfo?.display_name || 'specialist'} to thread.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Assignment error';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsMutating(false);
    }
  };

  // Handle removing an admin assignment
  const handleRemoveAdmin = async (adminId: string, adminName: string) => {
    if (!confirm(`Are you sure you want to remove ${adminName} from this conversation? Their query access will be immediately revoked.`)) {
      return;
    }

    setIsMutating(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/conversations/${selectedConvId}/assignments?admin_id=${adminId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove assignment');
      }

      const now = new Date().toISOString();
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConvId
            ? {
                ...c,
                assignments: (c.assignments || []).map((a) =>
                  a.admin_id === adminId && a.status === 'active'
                    ? { ...a, status: 'removed', removed_at: now }
                    : a
                ),
              }
            : c
        )
      );

      setFeedback({
        type: 'success',
        message: `Successfully removed ${adminName}. Authorization was immediately revoked in PostgreSQL.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Removal error';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              Super Admin Controls
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Specialist Assignment Hub
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            Control which specialists are authorized to participate in customer support threads. Multi-admin support enables team collaboration.
          </p>
        </div>

        <Link
          href="/super-admin/conversations"
          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <span>All Conversations</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 border text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="font-semibold text-xs ml-3 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Two-Column Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Conversation Selector (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden flex flex-col h-[700px]">
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-50/50 dark:bg-neutral-900/50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-purple-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
              {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold capitalize transition-colors shrink-0 ${
                    statusFilter === st
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                No matching conversations found.
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.id === selectedConvId;
                const activeCount = (c.assignments || []).filter((a) => a.status === 'active').length;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedConvId(c.id);
                      setFeedback(null);
                    }}
                    className={`w-full text-left p-4 transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-purple-50/70 border-l-4 border-purple-600 dark:bg-purple-950/30'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-neutral-900 dark:text-white">
                        {c.customer?.display_name || 'Customer'}
                      </span>
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
                    </div>

                    <p className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
                      {c.subject || 'General Support'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <UserCheck className="h-3 w-3 text-purple-600" />
                        <span>{activeCount} {activeCount === 1 ? 'Specialist' : 'Specialists'}</span>
                      </span>
                      <span>{new Date(c.last_message_at || c.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Selected Conversation Assignment Workspace (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {!selectedConversation ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
              <EmptyState
                icon={UserCheck}
                title="Select a conversation"
                description="Choose a customer support thread from the left pane to manage assigned specialists and inspect coverage history."
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Conversation Overview Card */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                      {selectedConversation.subject || 'General Support'}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Customer: <strong>{selectedConversation.customer?.display_name || 'Customer'}</strong> • ID: <span className="font-mono">{selectedConversation.id}</span>
                    </p>
                  </div>

                  <Link
                    href={`/admin/conversations/${selectedConversation.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 transition-colors self-start sm:self-auto"
                  >
                    <span>Open Live Thread</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Assignment Controls & Current Team */}
                <div className="pt-5 space-y-6">
                  {/* Current Assigned Specialists */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-purple-600" />
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                          Currently Assigned Specialists ({activeAssignments.length})
                        </h4>
                      </div>
                      <span className="text-[11px] text-neutral-400">
                        Multi-admin shared history
                      </span>
                    </div>

                    {activeAssignments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                        No specialists are currently assigned to this conversation. Use the form below to assign a staff member.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeAssignments.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-800/40"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold text-xs">
                                {a.admin?.display_name?.slice(0, 2).toUpperCase() || 'AD'}
                              </div>
                              <div>
                                <p className="font-semibold text-neutral-900 dark:text-white">
                                  {a.admin?.display_name || 'Admin'}
                                </p>
                                <p className="text-[10px] text-neutral-400">
                                  Assigned {new Date(a.assigned_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => handleRemoveAdmin(a.admin_id, a.admin?.display_name || 'Specialist')}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-neutral-900 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                              title="Revoke access"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Specialist Form */}
                  <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/70 space-y-3">
                    <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      Assign New Specialist
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedAdminToAssign}
                        onChange={(e) => setSelectedAdminToAssign(e.target.value)}
                        disabled={isMutating || assignableAdmins.length === 0}
                        className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-purple-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-white disabled:opacity-50"
                      >
                        <option value="">
                          {assignableAdmins.length === 0
                            ? 'All eligible specialists already assigned'
                            : 'Select specialist to assign...'}
                        </option>
                        {assignableAdmins.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.display_name} ({admin.role.replace('_', ' ')})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={!selectedAdminToAssign || isMutating}
                        onClick={handleAssignAdmin}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        {isMutating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        <span>Assign Specialist</span>
                      </button>
                    </div>
                  </div>

                  {/* Assignment History Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <History className="h-4 w-4 text-neutral-500" />
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        Assignment History &amp; Audit Log
                      </h4>
                    </div>

                    {assignmentHistory.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic">No past removed assignments for this conversation.</p>
                    ) : (
                      <div className="space-y-2">
                        {assignmentHistory.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-xs border border-neutral-200 dark:bg-neutral-800/40 dark:border-neutral-800 text-neutral-500"
                          >
                            <div>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                {h.admin?.display_name || 'Specialist'}
                              </span>
                              <span className="ml-2 text-[10px] text-neutral-400">
                                Assigned: {new Date(h.assigned_at).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-neutral-400 text-[11px]">
                              <Clock className="h-3 w-3" />
                              <span>Removed {h.removed_at ? new Date(h.removed_at).toLocaleDateString() : ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Security & Access Severance Info */}
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-5 dark:border-neutral-800 dark:bg-neutral-900/40 text-xs text-neutral-600 dark:text-neutral-400 space-y-2">
                <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-semibold">
                  <Shield className="h-4 w-4 text-purple-600" />
                  <span>PostgreSQL Security Enforcement</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Removing an admin assignment updates the record to <code>status = &apos;removed&apos;</code> with a timestamp. PostgreSQL RLS policies immediately invalidate the admin&apos;s <code>is_assigned_to_conversation()</code> check, completely blocking subsequent reads and writes without destroying historical audit data.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
