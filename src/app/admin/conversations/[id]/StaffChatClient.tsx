'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  ArrowLeft,
  UserCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  UserPlus,
  Trash2,
  Wifi,
  WifiOff,
  UserX,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { ConversationStatus } from '@/types/database';

interface StaffChatMessage {
  id: string;
  conversation_id: string;
  sender_id?: string;
  body: string;
  message_type: string;
  created_at: string;
  is_self: boolean;
  sender_name: string;
  sender_role: string;
  status?: 'pending' | 'sent' | 'failed';
  errorDetails?: string;
}

interface AssignedStaff {
  id: string;
  admin_id: string;
  status: string;
  admin?: {
    id: string;
    display_name: string;
    role: string;
  } | null;
}

interface StaffChatClientProps {
  conversationId: string;
  initialConversation: {
    id: string;
    customer_id: string;
    subject: string | null;
    status: ConversationStatus;
    last_message_at: string;
    created_at: string;
    customer?: {
      id: string;
      display_name: string;
      role: string;
    } | null;
  };
  initialMessages: StaffChatMessage[];
  initialAssignedStaff: AssignedStaff[];
  currentUser: {
    id: string;
    role: string;
    displayName: string;
  };
  availableAdmins?: { id: string; display_name: string }[];
}

export function StaffChatClient({
  conversationId,
  initialConversation,
  initialMessages,
  initialAssignedStaff,
  currentUser,
  availableAdmins = [],
}: StaffChatClientProps) {
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState<StaffChatMessage[]>(initialMessages);
  const [assignedStaff, setAssignedStaff] = useState<AssignedStaff[]>(initialAssignedStaff);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedAdminToAssign, setSelectedAdminToAssign] = useState('');

  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isAccessRevoked, setIsAccessRevoked] = useState(false);
  const [revocationDetails, setRevocationDetails] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  // Auto-scroll inside chat container strictly (never moves outer window or mobile viewport)
  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Connect to Supabase Realtime via postgres_changes and broadcast for instant live delivery
  useEffect(() => {
    if (!conversationId || isAccessRevoked) return;

    const supabase = createClient();
    const topic = `chat:${conversationId}`;

    // Sync auth token with Realtime WebSocket connection
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    const channel = supabase.channel(topic);
    channelRef.current = channel;

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as {
            id: string;
            conversation_id: string;
            body: string;
            message_type: string;
            created_at: string;
            sender_id: string;
          };
          if (!newMsg || !newMsg.id) return;

          const isSelf = newMsg.sender_id === currentUser.id;
          const formattedMsg: StaffChatMessage = {
            id: newMsg.id,
            conversation_id: newMsg.conversation_id,
            sender_id: newMsg.sender_id,
            body: newMsg.body,
            message_type: newMsg.message_type,
            created_at: newMsg.created_at,
            is_self: isSelf,
            sender_name: isSelf ? 'You' : (conversation.customer?.display_name || 'Customer'),
            sender_role: isSelf ? currentUser.role : 'customer',
            status: 'sent',
          };

          setMessages((prev) => {
            // 1. Direct ID match
            const idxById = prev.findIndex((m) => m.id === newMsg.id);
            if (idxById !== -1) {
              const updated = [...prev];
              updated[idxById] = { ...updated[idxById], ...formattedMsg, status: 'sent' };
              return updated;
            }

            // 2. Optimistic match for self (bridges temp ID vs DB UUID)
            if (isSelf) {
              const pendingIdx = prev.findIndex(
                (m) => (m.status === 'pending' || m.id.startsWith('temp-')) && m.body.trim() === newMsg.body.trim()
              );
              if (pendingIdx !== -1) {
                const updated = [...prev];
                updated[pendingIdx] = { ...updated[pendingIdx], ...formattedMsg, status: 'sent' };
                return updated;
              }
            }

            // 3. Peer match by body + recent timestamp (bridges broadcast tempId vs DB UUID)
            const idxByContent = prev.findIndex(
              (m) =>
                m.body.trim() === newMsg.body.trim() &&
                m.is_self === isSelf &&
                Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 15000
            );
            if (idxByContent !== -1) {
              const updated = [...prev];
              updated[idxByContent] = { ...updated[idxByContent], ...formattedMsg, status: 'sent' };
              return updated;
            }

            return [...prev, formattedMsg];
          });
        }
      )
      .on(
        'broadcast',
        { event: 'new_message' },
        (response: {
          payload: {
            id: string;
            conversation_id: string;
            body: string;
            message_type: string;
            created_at: string;
            sender_id?: string;
            sender_role: string;
            sender_name?: string;
            true_sender_name?: string;
          };
        }) => {
          const newMsg = response.payload;
          if (!newMsg || !newMsg.id) return;
          // Ignore own broadcasts: sender already manages optimistic state
          if (newMsg.sender_id === currentUser.id) return;

          const isSelf = false;
          const staffSenderName = newMsg.true_sender_name || newMsg.sender_name || 'Staff Specialist';

          const formattedMsg: StaffChatMessage = {
            id: newMsg.id,
            conversation_id: newMsg.conversation_id,
            sender_id: newMsg.sender_id,
            body: newMsg.body,
            message_type: newMsg.message_type,
            created_at: newMsg.created_at,
            is_self: isSelf,
            sender_name: newMsg.sender_role === 'customer' ? (newMsg.sender_name || 'Customer') : staffSenderName,
            sender_role: newMsg.sender_role,
            status: 'sent',
          };

          setMessages((prev) => {
            // 1. Direct ID match
            const idxById = prev.findIndex((m) => m.id === newMsg.id);
            if (idxById !== -1) {
              return prev;
            }

            // 2. Peer match by body + recent timestamp
            const idxByContent = prev.findIndex(
              (m) =>
                m.body.trim() === newMsg.body.trim() &&
                m.is_self === isSelf &&
                Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 15000
            );
            if (idxByContent !== -1) {
              const updated = [...prev];
              updated[idxByContent] = { ...updated[idxByContent], ...formattedMsg, status: 'sent' };
              return updated;
            }

            return [...prev, formattedMsg];
          });
        }
      )
      .on(
        'broadcast',
        { event: 'assignment_revoked' },
        (response: { payload: { conversation_id: string; admin_id: string; revoked_at: string } }) => {
          if (response?.payload?.admin_id === currentUser.id) {
            setIsAccessRevoked(true);
            setRevocationDetails('Your active assignment to this conversation was revoked by a Super Administrator.');
          }
        }
      )
      .on('broadcast', { event: 'assignment_added' }, () => {
        // Refresh conversation assignment list
      })
      .on('broadcast', { event: 'status_changed' }, (response: { payload: { status: ConversationStatus } }) => {
        if (response?.payload?.status) {
          setConversation((prev) => ({ ...prev, status: response.payload.status }));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUser.id, isAccessRevoked]);

  // Load earlier messages
  const handleLoadEarlier = async () => {
    if (messages.length === 0 || isLoadingMore) return;
    setIsLoadingMore(true);
    setErrorBanner(null);

    const oldest = messages[0];
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?before=${encodeURIComponent(
          oldest.created_at
        )}&limit=30`
      );
      if (!res.ok) throw new Error('Failed to load earlier messages');
      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(data.has_more);
      } else {
        setHasMore(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading earlier history';
      setErrorBanner(msg);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Send message as Staff (Non-blocking background delivery)
  const handleSendMessage = async (textToSend?: string, retryId?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text) return;

    if (text.length > 5000) {
      setErrorBanner('Message is too long. Limit is 5000 characters.');
      return;
    }

    setErrorBanner(null);

    // eslint-disable-next-line react-hooks/purity
    const tempId = retryId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimisticMessage: StaffChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      body: text,
      message_type: 'text',
      created_at: new Date().toISOString(),
      is_self: true,
      sender_name: 'You',
      sender_role: currentUser.role,
      status: 'sent',
    };

    if (retryId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === retryId ? { ...m, status: 'sent', errorDetails: undefined } : m))
      );
    } else {
      setMessages((prev) => [...prev, optimisticMessage]);
      setInputText('');
    }

    // Immediately broadcast via WebSocket for sub-30ms instant peer delivery
    try {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
            id: tempId,
            conversation_id: conversationId,
            body: text,
            message_type: 'text',
            created_at: new Date().toISOString(),
            sender_id: currentUser.id,
            sender_role: currentUser.role,
            sender_name: currentUser.displayName || 'Support Team',
          },
        });
      }
    } catch {
      // Fallback silently to HTTP persistence
    }

    // Perform background database persistence
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, message_type: 'text' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...data.message,
                status: 'sent',
              }
            : m
        )
      );

      // Automatically move status to 'in_progress' if currently 'open'
      if (conversation.status === 'open') {
        handleUpdateStatus('in_progress');
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Delivery error';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                status: 'failed',
                errorDetails: errText,
              }
            : m
        )
      );
      setErrorBanner(errText);
    }
  };

  // Update conversation status
  const handleUpdateStatus = async (newStatus: ConversationStatus) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      setConversation(data.conversation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      setErrorBanner(msg);
    }
  };

  // Super Admin: Assign specialist
  const handleAssignAdmin = async () => {
    if (!selectedAdminToAssign || isAssigning) return;
    setIsAssigning(true);
    setErrorBanner(null);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: selectedAdminToAssign }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign admin');

      // Refresh assigned staff
      const foundAdmin = availableAdmins.find((a) => a.id === selectedAdminToAssign);
      setAssignedStaff((prev) => [
        ...prev.filter((p) => p.admin_id !== selectedAdminToAssign),
        {
          id: data.assignment.id,
          admin_id: selectedAdminToAssign,
          status: 'active',
          admin: foundAdmin ? { id: foundAdmin.id, display_name: foundAdmin.display_name, role: 'admin' } : null,
        },
      ]);
      setSelectedAdminToAssign('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Assignment failed';
      setErrorBanner(msg);
    } finally {
      setIsAssigning(false);
    }
  };

  // Super Admin: Unassign specialist
  const handleRemoveAssignment = async (adminId: string) => {
    if (!confirm('Remove this specialist from this conversation?')) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}/assignments?admin_id=${adminId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove assignment');
      setAssignedStaff((prev) => prev.filter((a) => a.admin_id !== adminId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Removal failed';
      setErrorBanner(msg);
    }
  };

  const isSuperAdmin = currentUser.role === 'super_admin';

  return (
    <div className="space-y-6">
      {/* Back and Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href={isSuperAdmin ? '/super-admin/conversations' : '/admin/conversations'}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to {isSuperAdmin ? 'All Conversations' : 'Assigned Inbox'}</span>
        </Link>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 font-medium">Status:</span>
          <select
            value={conversation.status}
            onChange={(e) => handleUpdateStatus(e.target.value as ConversationStatus)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {errorBanner && (
        <div className="flex items-center justify-between rounded-xl bg-red-50 p-4 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-red-600 hover:text-red-800 dark:text-red-400 font-semibold text-xs ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Chat Workspace + Assignment Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Chat Thread (3 cols) */}
        <div className="lg:col-span-3 rounded-2xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden flex flex-col h-[650px]">
          {/* Thread Header */}
          <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900/70 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Customer: {conversation.customer?.display_name || 'Customer'}
                </h2>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                  ID: {conversation.id.slice(0, 8)}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Subject: {conversation.subject || 'General Support'} • Created {new Date(conversation.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Realtime Live Delivery Pill */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                  realtimeStatus === 'connected'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : realtimeStatus === 'connecting'
                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'
                }`}
                title={
                  realtimeStatus === 'connected'
                    ? 'Connected to live real-time event stream'
                    : realtimeStatus === 'connecting'
                    ? 'Establishing secure real-time WebSocket connection...'
                    : 'Offline - Falling back to database sync'
                }
              >
                {realtimeStatus === 'connected' ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <Wifi className="h-2.5 w-2.5" />
                    <span>Live</span>
                  </>
                ) : realtimeStatus === 'connecting' ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-2.5 w-2.5" />
                    <span>Offline</span>
                  </>
                )}
              </span>

              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                  conversation.status === 'open'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                    : conversation.status === 'in_progress'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                    : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {conversation.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/30 dark:bg-neutral-950/20"
          >
            {hasMore && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={handleLoadEarlier}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 shadow-2xs transition-colors"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading history...</span>
                    </>
                  ) : (
                    <span>Load earlier messages</span>
                  )}
                </button>
              </div>
            )}

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  No messages yet
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm">
                  Send a response below to initiate specialist contact with the customer.
                </p>
              </div>
            )}

            {/* Messages Rendering with TRUE SENDER ATTRIBUTION for Staff */}
            {messages.map((msg) => {
              const isSelf = msg.is_self;
              const isCustomer = msg.sender_role === 'customer';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                >
                  {/* Real Sender Attribution Header */}
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-neutral-400">
                    <span
                      className={`font-medium ${
                        isCustomer
                          ? 'text-purple-600 dark:text-purple-400'
                          : isSelf
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {msg.sender_name}
                      {msg.sender_role ? ` (${msg.sender_role})` : ''}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-lg rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words ${
                      isSelf
                        ? 'bg-blue-600 text-white rounded-tr-xs'
                        : isCustomer
                        ? 'bg-white border border-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white rounded-tl-xs'
                        : 'bg-amber-50 border border-amber-200 text-neutral-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100 rounded-tl-xs'
                    }`}
                  >
                    {msg.body}
                  </div>

                  {/* Outgoing status: only show retry button if transmission failed */}
                  {isSelf && msg.status === 'failed' && (
                    <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-red-500 font-medium">
                      <span>Failed to send</span>
                      <button
                        type="button"
                        onClick={() => handleSendMessage(msg.body, msg.id)}
                        className="inline-flex items-center gap-0.5 underline hover:text-red-400 ml-1"
                      >
                        <RotateCcw className="h-2.5 w-2.5" />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Staff Reply Bar */}
          <div className="border-t border-neutral-200 p-4 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            {isAccessRevoked ? (
              <div className="flex items-center gap-3 rounded-xl bg-red-50 p-4 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200">
                <UserX className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Access Revoked</p>
                  <p className="text-[11px] text-red-600 dark:text-red-300">
                    {revocationDetails || 'Your assignment to this conversation has been revoked. Real-time access is terminated.'}
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-3"
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Write a specialist response to customer..."
                    maxLength={5000}
                    disabled={isAccessRevoked}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500 disabled:opacity-50"
                  />
                  {inputText.length > 3000 && (
                    <span className="absolute right-3 top-3 text-[10px] text-neutral-400">
                      {inputText.length}/5000
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isAccessRevoked}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors shrink-0"
                >
                  <Send className="h-4 w-4" />
                  <span>Send Reply</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Assigned Specialists & Conversation Metadata (1 col) */}
        <div className="space-y-6">
          {/* Assigned Specialists Panel */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Assigned Specialists
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Multi-admin support: All assigned specialists share this exact conversation history.
            </p>

            <div className="space-y-2">
              {assignedStaff.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">No specialist explicitly assigned.</p>
              ) : (
                assignedStaff.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-xs border border-neutral-200 dark:bg-neutral-800/50 dark:border-neutral-700"
                  >
                    <div>
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">
                        {staff.admin?.display_name || staff.admin_id.slice(0, 8)}
                      </p>
                      <p className="text-[10px] text-neutral-400 capitalize">
                        {staff.admin?.role || 'Admin'}
                      </p>
                    </div>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignment(staff.admin_id)}
                        className="text-neutral-400 hover:text-red-600 transition-colors"
                        title="Remove specialist"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Super Admin Assign Form */}
            {isSuperAdmin && availableAdmins.length > 0 && (
              <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Assign Specialist
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedAdminToAssign}
                    onChange={(e) => setSelectedAdminToAssign(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                  >
                    <option value="">Select admin...</option>
                    {availableAdmins
                      .filter((a) => !assignedStaff.some((as) => as.admin_id === a.id))
                      .map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.display_name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedAdminToAssign || isAssigning}
                    onClick={handleAssignAdmin}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Privacy & Attribution Notice */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-5 dark:border-neutral-800 dark:bg-neutral-900/40 text-xs text-neutral-600 dark:text-neutral-400 space-y-2">
            <p className="font-semibold text-neutral-800 dark:text-neutral-200">
              Staff Attribution &amp; Privacy Rule
            </p>
            <p className="text-[11px] leading-relaxed">
              When you send a reply, the customer sees it labeled as <strong>Support Team</strong> to protect individual staff privacy. Internally, your real name and timestamp are preserved for compliance and team collaboration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
