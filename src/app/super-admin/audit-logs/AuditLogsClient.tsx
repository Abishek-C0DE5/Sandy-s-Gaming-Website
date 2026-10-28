'use client';

import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
  ShieldCheck,
  Mail,
  FileText,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export interface AuditLogItem {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: {
    id: string;
    display_name: string;
    email: string;
    role: string;
  } | null;
}

interface AuditLogsClientProps {
  initialLogs: AuditLogItem[];
}

export function AuditLogsClient({ initialLogs }: AuditLogsClientProps) {
  const [logs] = useState<AuditLogItem[]>(initialLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionCategory, setActionCategory] = useState<'all' | 'users' | 'assignments' | 'inquiries'>('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (actionCategory === 'users') {
        const isUserAction =
          log.action.startsWith('USER_') || log.target_type === 'profile';
        if (!isUserAction) return false;
      } else if (actionCategory === 'assignments') {
        const isAssignmentAction =
          log.action.includes('ASSIGN') || log.target_type === 'conversation_assignment';
        if (!isAssignmentAction) return false;
      } else if (actionCategory === 'inquiries') {
        const isInquiryAction =
          log.action.includes('INQUIRY') || log.target_type === 'contact_inquiry';
        if (!isInquiryAction) return false;
      }

      // Target type filter
      if (targetTypeFilter !== 'all' && log.target_type !== targetTypeFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const actionMatch = log.action.toLowerCase().includes(q);
        const targetTypeMatch = log.target_type.toLowerCase().includes(q);
        const targetIdMatch = log.target_id?.toLowerCase().includes(q) || false;
        const actorNameMatch = log.actor?.display_name.toLowerCase().includes(q) || false;
        const actorEmailMatch = log.actor?.email.toLowerCase().includes(q) || false;
        const metadataMatch = JSON.stringify(log.metadata || {}).toLowerCase().includes(q);

        return (
          actionMatch ||
          targetTypeMatch ||
          targetIdMatch ||
          actorNameMatch ||
          actorEmailMatch ||
          metadataMatch
        );
      }

      return true;
    });
  }, [logs, actionCategory, targetTypeFilter, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('SUSPEND') || action.includes('DELETE') || action.includes('DENIED')) {
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900';
    }
    if (action.includes('ASSIGN') || action.includes('PROMOTED') || action.includes('REACTIVATED') || action.includes('PROVISIONED')) {
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900';
    }
    if (action.includes('REPLY') || action.includes('SENT') || action.includes('RESOLVED')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900';
    }
    return 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700';
  };

  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case 'profile':
        return <User className="h-3.5 w-3.5 text-purple-500" />;
      case 'conversation_assignment':
        return <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />;
      case 'contact_inquiry':
        return <Mail className="h-3.5 w-3.5 text-amber-500" />;
      case 'post':
        return <FileText className="h-3.5 w-3.5 text-emerald-500" />;
      default:
        return <History className="h-3.5 w-3.5 text-neutral-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action, actor, target ID, or metadata terms..."
            className="w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-4 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-purple-500 focus:outline-hidden focus:ring-1 focus:ring-purple-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action Category Filter */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl dark:bg-neutral-800 text-xs font-medium">
            <Filter className="h-3.5 w-3.5 text-neutral-400 ml-1.5" />
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'users', label: 'Staff' },
                { key: 'assignments', label: 'Assignments' },
                { key: 'inquiries', label: 'Inquiries' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActionCategory(cat.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  actionCategory === cat.key
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Target Type Filter */}
          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 focus:border-purple-500 focus:outline-hidden"
          >
            <option value="all">All Targets</option>
            <option value="profile">Profiles / Staff</option>
            <option value="conversation_assignment">Assignments</option>
            <option value="contact_inquiry">Contact Inquiries</option>
            <option value="post">Posts</option>
          </select>
        </div>
      </div>

      {/* Log Feed */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={History}
          title={searchQuery || actionCategory !== 'all' || targetTypeFilter !== 'all' ? 'No matching audit events' : 'No audit events recorded'}
          description={
            searchQuery || actionCategory !== 'all' || targetTypeFilter !== 'all'
              ? 'Try relaxing your filter criteria or search terms.'
              : 'Sensitive administrative modifications will automatically generate immutable event logs here.'
          }
        />
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
          <div className="border-b border-neutral-200 px-6 py-3.5 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
            <span>Showing {filteredLogs.length} audit trail records</span>
            <span className="font-mono text-[11px]">Chronological Order (DESC)</span>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div
                  key={log.id}
                  className="p-4 sm:p-5 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(log.id)}
                        className="mt-0.5 sm:mt-0 p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
                        title={isExpanded ? 'Collapse details' : 'Expand metadata'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-bold font-mono tracking-wide ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>

                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                            {getTargetIcon(log.target_type)}
                            <span className="capitalize">{log.target_type.replace('_', ' ')}</span>
                            {log.target_id && (
                              <span className="font-mono text-neutral-400">
                                ({log.target_id.slice(0, 8)}...)
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                          <span className="font-medium">
                            Actor:{' '}
                            <span className="text-neutral-900 dark:text-white font-semibold">
                              {log.actor?.display_name || 'System / Service Role'}
                            </span>
                            {log.actor?.email && (
                              <span className="text-neutral-400 ml-1">({log.actor.email})</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-neutral-400 self-end sm:self-center font-mono">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Expandable Structured Metadata Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 pl-8 space-y-2">
                      <div className="flex items-center justify-between text-xs text-neutral-500 font-semibold uppercase tracking-wider">
                        <span>Event Details &amp; Payload Metadata</span>
                        <span className="font-mono text-[10px] text-neutral-400">Log ID: {log.id}</span>
                      </div>

                      {hasMetadata ? (
                        <pre className="rounded-xl bg-neutral-900 p-3.5 text-[11px] font-mono text-emerald-400 overflow-x-auto shadow-inner">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">No additional metadata attached.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
