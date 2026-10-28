'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Phone,
  User,
  Clock,
  Send,
  Loader2,
  History,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmailDeliveryStatus } from '@/types/database';

interface InquiryData {
  id: string;
  name: string | null;
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'in_progress' | 'replied' | 'closed';
  assigned_admin_id: string | null;
  replied_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_admin?: {
    id: string;
    display_name: string;
    email: string | null;
  } | null;
}

interface ReplyData {
  id: string;
  inquiry_id: string;
  admin_id: string;
  body: string;
  email_delivery_status: EmailDeliveryStatus;
  provider_message_id: string | null;
  last_delivery_error?: string | null;
  idempotency_key?: string | null;
  retry_count?: number;
  last_attempted_at?: string | null;
  sent_at: string | null;
  created_at: string;
  admin?: {
    display_name: string;
    email: string | null;
  } | null;
}

interface AdminProfile {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
}

export interface EmailConfigInfo {
  isConfigured: boolean;
  provider: string;
  fromAddress: string;
}

interface InquiryDetailClientProps {
  inquiry: InquiryData;
  replies: ReplyData[];
  availableStaff: AdminProfile[];
  currentUserId: string;
  emailConfig: EmailConfigInfo;
}

function getStatusBadge(status: EmailDeliveryStatus) {
  switch (status) {
    case 'accepted':
      return {
        label: 'Accepted by Provider',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
        icon: CheckCircle2,
      };
    case 'sent':
      return {
        label: 'Dispatched / Sent',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
        icon: CheckCircle2,
      };
    case 'delivered':
      return {
        label: 'Delivered to Inbox',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        icon: CheckCircle2,
      };
    case 'queued':
      return {
        label: 'Queued',
        className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
        icon: Clock,
      };
    case 'failed':
      return {
        label: 'Delivery Failed',
        className: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
        icon: AlertCircle,
      };
    case 'bounced':
      return {
        label: 'Bounced',
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
        icon: AlertCircle,
      };
    case 'pending':
    default:
      return {
        label: 'Draft / Pending Dispatch',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
        icon: Clock,
      };
  }
}

export function InquiryDetailClient({
  inquiry: initialInquiry,
  replies: initialReplies,
  availableStaff,
  currentUserId,
  emailConfig,
}: InquiryDetailClientProps) {
  const router = useRouter();

  const [inquiry, setInquiry] = useState<InquiryData>(initialInquiry);
  const [replies, setReplies] = useState<ReplyData[]>(initialReplies);
  const [status, setStatus] = useState(initialInquiry.status);
  const [assignedAdminId, setAssignedAdminId] = useState<string>(
    initialInquiry.assigned_admin_id || ''
  );

  const [replyBody, setReplyBody] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [retryingReplyId, setRetryingReplyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Update Status handler
  const handleStatusChange = async (newStatus: 'new' | 'in_progress' | 'replied' | 'closed') => {
    setActionError(null);
    setActionSuccess(null);
    setIsUpdatingStatus(true);

    try {
      const res = await fetch(`/api/admin/contact-requests/${inquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      setStatus(newStatus);
      setInquiry((prev) => ({ ...prev, status: newStatus }));
      setActionSuccess(`Inquiry status updated to "${newStatus.replace('_', ' ')}".`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating status';
      setActionError(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Update Assignment handler
  const handleAssignmentChange = async (newAdminId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setIsUpdatingAssignment(true);

    try {
      const payload = {
        assigned_admin_id: newAdminId ? newAdminId : null,
      };

      const res = await fetch(`/api/admin/contact-requests/${inquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reassign inquiry');

      setAssignedAdminId(newAdminId);
      const assignedProfile = availableStaff.find((s) => s.id === newAdminId) || null;
      setInquiry((prev) => ({
        ...prev,
        assigned_admin_id: newAdminId || null,
        assigned_admin: assignedProfile,
      }));
      setActionSuccess(
        newAdminId ? `Inquiry assigned to ${assignedProfile?.display_name}.` : 'Inquiry unassigned.'
      );
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error reassigning inquiry';
      setActionError(msg);
    } finally {
      setIsUpdatingAssignment(false);
    }
  };

  // Record or Send Reply handler
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;

    setActionError(null);
    setActionSuccess(null);
    setIsSendingReply(true);

    try {
      const idempotencyKey = `reply_${inquiry.id}_${Date.now()}`;

      const res = await fetch(`/api/admin/contact-requests/${inquiry.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: replyBody.trim(),
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record response');

      const currentStaff = availableStaff.find((s) => s.id === currentUserId);
      const newReply: ReplyData = {
        ...data.reply,
        admin: currentStaff || { display_name: 'Current Staff', email: null },
      };

      setReplies((prev) => [...prev, newReply]);
      setReplyBody('');
      setStatus('replied');
      setInquiry((prev) => ({ ...prev, status: 'replied', replied_at: new Date().toISOString() }));

      if (data.isConfigured && data.status === 'accepted') {
        setActionSuccess(data.message || 'Email response accepted by provider.');
      } else {
        setActionSuccess(
          data.isConfigured
            ? `Dispatch attempted via ${data.provider}: ${data.status}`
            : 'Draft saved in database. (Email provider is unconfigured in server environment).'
        );
      }
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting reply';
      setActionError(msg);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Retry failed/pending delivery handler
  const handleRetryReply = async (replyId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setRetryingReplyId(replyId);

    try {
      const res = await fetch(
        `/api/admin/contact-requests/${inquiry.id}/replies/${replyId}/retry`,
        {
          method: 'POST',
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retry attempt failed');

      setReplies((prev) =>
        prev.map((r) => (r.id === replyId ? { ...r, ...data.reply } : r))
      );

      setActionSuccess(data.message || 'Retry completed.');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error executing retry';
      setActionError(msg);
    } finally {
      setRetryingReplyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider Status Disclosure Banner */}
      {!emailConfig.isConfigured ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <span className="font-semibold block text-sm mb-0.5">
                Email Provider Unconfigured (BLOCKED)
              </span>
              Server environment currently has no active transactional email credentials (
              <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono">
                EMAIL_API_KEY
              </code>{' '}
              is unset). Staff replies are safely recorded in PostgreSQL as drafts with status{' '}
              <code className="font-mono">pending</code>. To enable live dispatch, select and configure
              Resend, SendGrid, or Postmark credentials in <code className="font-mono">.env.local</code>.
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>
              <strong>Active Email Provider:</strong> {emailConfig.provider.toUpperCase()} &bull; Sending from{' '}
              <code className="font-mono">{emailConfig.fromAddress}</code>
            </span>
          </div>
          <span className="rounded-md bg-blue-200/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Connected
          </span>
        </div>
      )}

      {actionError && (
        <Alert variant="error" title="Action Failed">
          {actionError}
        </Alert>
      )}

      {actionSuccess && (
        <Alert variant="success" title="Notification">
          {actionSuccess}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Inquiry Content & Reply History (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Guest Message Card */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3 mb-4">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Inquiry Message
              </span>
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{new Date(inquiry.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed font-sans">
              {inquiry.message}
            </div>
          </div>

          {/* Reply History */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <History className="h-4 w-4 text-neutral-400" />
              <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                Follow-up Reply History ({replies.length})
              </h3>
            </div>

            {replies.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-2">
                No replies recorded yet for this inquiry. Compose a response below.
              </p>
            ) : (
              <div className="space-y-4">
                {replies.map((reply) => {
                  const badge = getStatusBadge(reply.email_delivery_status);
                  const BadgeIcon = badge.icon;
                  const canRetry =
                    ['failed', 'pending'].includes(reply.email_delivery_status) &&
                    (reply.retry_count ?? 0) < 5;

                  return (
                    <div
                      key={reply.id}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40 space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                        <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-neutral-400" />
                          <span>{reply.admin?.display_name || 'Staff Member'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                          >
                            <BadgeIcon className="h-3 w-3" />
                            <span>{badge.label}</span>
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            {new Date(reply.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                        {reply.body}
                      </div>

                      {/* Technical Delivery Info */}
                      <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
                        <div className="flex items-center gap-3">
                          {reply.provider_message_id && (
                            <span className="font-mono">
                              ID: {reply.provider_message_id}
                            </span>
                          )}
                          {reply.retry_count && reply.retry_count > 0 ? (
                            <span>Retries: {reply.retry_count}</span>
                          ) : null}
                          {reply.sent_at && (
                            <span>Sent: {new Date(reply.sent_at).toLocaleTimeString()}</span>
                          )}
                        </div>

                        {canRetry && (
                          <button
                            type="button"
                            onClick={() => handleRetryReply(reply.id)}
                            disabled={retryingReplyId === reply.id}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                          >
                            {retryingReplyId === reply.id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            <span>Retry Send</span>
                          </button>
                        )}
                      </div>

                      {/* Error details if failed */}
                      {reply.last_delivery_error && (
                        <div className="rounded-md bg-red-50 p-2 text-[11px] text-red-700 dark:bg-red-950/30 dark:text-red-300 font-mono">
                          {reply.last_delivery_error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Compose Response Section */}
            <form onSubmit={handleSendReply} className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
              <div>
                <label
                  htmlFor="staff-reply-box"
                  className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1"
                >
                  Send Response to {inquiry.email}
                </label>
                <textarea
                  id="staff-reply-box"
                  rows={4}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Compose email response..."
                  className="w-full rounded-lg border border-neutral-300 bg-white p-3 text-xs text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-neutral-400">
                  {emailConfig.isConfigured
                    ? `Will dispatch live email via ${emailConfig.provider}`
                    : 'Will record internal draft in database'}
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSendingReply || !replyBody.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold"
                >
                  {isSendingReply ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      <span>
                        {emailConfig.isConfigured ? 'Send Email Response' : 'Save Draft Reply'}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Metadata, Triage Controls & Assignment (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Status Management Card */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
              Triage Status
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'new', label: 'New', desc: 'Unreviewed' },
                { val: 'in_progress', label: 'In Progress', desc: 'Under review' },
                { val: 'replied', label: 'Replied', desc: 'Response drafted/sent' },
                { val: 'closed', label: 'Closed', desc: 'Resolved' },
              ].map((item) => {
                const isSelected = status === item.val;
                return (
                  <button
                    key={item.val}
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => handleStatusChange(item.val as 'new' | 'in_progress' | 'replied' | 'closed')}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200 font-semibold'
                        : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs capitalize">{item.label}</span>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-0.5">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Staff Assignment Card */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 space-y-3">
            <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Staff Assignment
            </h3>

            <select
              value={assignedAdminId}
              disabled={isUpdatingAssignment}
              onChange={(e) => handleAssignmentChange(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="">Unassigned</option>
              {availableStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.display_name} ({staff.role.replace('_', ' ')})
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[11px] text-neutral-400">Quick action:</span>
              <button
                type="button"
                onClick={() => handleAssignmentChange(currentUserId)}
                disabled={isUpdatingAssignment || assignedAdminId === currentUserId}
                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 disabled:opacity-50"
              >
                Assign to Myself
              </button>
            </div>
          </div>

          {/* Guest Contact Details */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 space-y-3">
            <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Guest Sender Info
            </h3>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-[10px] text-neutral-400 block">Name</span>
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {inquiry.name || 'Anonymous Visitor'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 block">Email Address</span>
                <a
                  href={`mailto:${inquiry.email}`}
                  className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1.5 mt-0.5"
                >
                  <Mail className="h-3 w-3" />
                  <span>{inquiry.email}</span>
                </a>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 block">Phone Number</span>
                <a
                  href={`tel:${inquiry.phone}`}
                  className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1.5 mt-0.5"
                >
                  <Phone className="h-3 w-3" />
                  <span>{inquiry.phone}</span>
                </a>
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                <div>
                  <span>Inquiry ID: </span>
                  <span className="font-mono text-[10px]">{inquiry.id}</span>
                </div>
                {inquiry.replied_at && (
                  <div>
                    <span>Last Replied: </span>
                    <span>{new Date(inquiry.replied_at).toLocaleString()}</span>
                  </div>
                )}
                {inquiry.closed_at && (
                  <div>
                    <span>Closed At: </span>
                    <span>{new Date(inquiry.closed_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
