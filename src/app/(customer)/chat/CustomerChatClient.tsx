'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Check,
  CheckCheck,
  Clock,
  ShieldCheck,
  XCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { ConversationStatus } from '@/types/database';

interface ChatMessage {
  id: string;
  conversation_id: string;
  body: string;
  message_type: string;
  created_at: string;
  is_self: boolean;
  sender_name: string;
  sender_role: string;
  // UI optimistic states
  status?: 'pending' | 'sent' | 'failed';
  errorDetails?: string;
}

interface ConversationData {
  id: string;
  customer_id: string;
  subject: string | null;
  status: ConversationStatus;
  last_message_at: string;
  created_at: string;
}

interface CustomerChatClientProps {
  initialConversation: ConversationData | null;
  initialMessages: ChatMessage[];
  currentUserId: string;
  customerDisplayName: string;
}

export function CustomerChatClient({
  initialConversation,
  initialMessages,
  currentUserId,
  customerDisplayName,
}: CustomerChatClientProps) {
  const [conversation, setConversation] = useState<ConversationData | null>(initialConversation);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>(() =>
    conversation?.id ? 'connecting' : 'disconnected'
  );

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
    if (!conversation?.id) {
      return;
    }

    const supabase = createClient();
    const convId = conversation.id;
    const topic = `chat:${convId}`;

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
          filter: `conversation_id=eq.${convId}`,
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

          const isSelf = newMsg.sender_id === currentUserId;
          const formattedMsg: ChatMessage = {
            id: newMsg.id,
            conversation_id: newMsg.conversation_id,
            body: newMsg.body,
            message_type: newMsg.message_type,
            created_at: newMsg.created_at,
            is_self: isSelf,
            sender_name: isSelf ? 'You' : 'Support Team',
            sender_role: isSelf ? 'customer' : 'staff',
            status: 'sent',
          };

          setMessages((prev) => {
            // 1. Direct match by ID
            const idxById = prev.findIndex((m) => m.id === newMsg.id);
            if (idxById !== -1) {
              const updated = [...prev];
              updated[idxById] = { ...updated[idxById], ...formattedMsg, status: 'sent' };
              return updated;
            }

            // 2. Pending optimistic match for self
            if (isSelf) {
              const pendingIdx = prev.findIndex(
                (m) => m.status === 'pending' && m.body.trim() === newMsg.body.trim()
              );
              if (pendingIdx !== -1) {
                const updated = [...prev];
                updated[pendingIdx] = { ...updated[pendingIdx], ...formattedMsg, status: 'sent' };
                return updated;
              }
            }

            // 3. Peer match by body + recent timestamp (bridges broadcast tempId vs DB UUID!)
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
          };
        }) => {
          const newMsg = response.payload;
          if (!newMsg || !newMsg.id) return;
          // Ignore own broadcasts: sender already has their own optimistic state
          if (newMsg.sender_id === currentUserId) return;

          const isStaff = newMsg.sender_role === 'admin' || newMsg.sender_role === 'super_admin';
          const formattedMsg: ChatMessage = {
            id: newMsg.id,
            conversation_id: newMsg.conversation_id,
            body: newMsg.body,
            message_type: newMsg.message_type,
            created_at: newMsg.created_at,
            is_self: false,
            sender_name: isStaff ? 'Support Team' : (newMsg.sender_name || 'Customer'),
            sender_role: isStaff ? 'staff' : 'customer',
            status: 'sent',
          };

          setMessages((prev) => {
            // 1. Direct ID match
            const idxById = prev.findIndex((m) => m.id === newMsg.id);
            if (idxById !== -1) {
              return prev;
            }

            // 2. Peer match by body + recent timestamp (prevents double append if already received)
            const idxByContent = prev.findIndex(
              (m) =>
                m.body.trim() === newMsg.body.trim() &&
                !m.is_self &&
                Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 15000
            );
            if (idxByContent !== -1) {
              return prev;
            }

            return [...prev, formattedMsg];
          });
        }
      )
      .on('broadcast', { event: 'status_changed' }, (response: { payload: { status: ConversationStatus } }) => {
        if (response?.payload?.status) {
          setConversation((prev) => (prev ? { ...prev, status: response.payload.status } : null));
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
  }, [conversation?.id, currentUserId]);

  // Load earlier messages for bounded pagination
  const handleLoadEarlier = async () => {
    if (!conversation || messages.length === 0 || isLoadingMore) return;
    setIsLoadingMore(true);
    setErrorBanner(null);

    const oldest = messages[0];
    try {
      const res = await fetch(
        `/api/conversations/${conversation.id}/messages?before=${encodeURIComponent(
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

  // Send a new message
  const handleSendMessage = async (textToSend?: string, retryId?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || !conversation || isSending) return;

    if (text.length > 5000) {
      setErrorBanner('Message is too long. Limit is 5000 characters.');
      return;
    }

    setErrorBanner(null);
    setIsSending(true);

    // Create temporary optimistic message
    // eslint-disable-next-line react-hooks/purity
    const tempId = retryId || `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversation_id: conversation.id,
      body: text,
      message_type: 'text',
      created_at: new Date().toISOString(),
      is_self: true,
      sender_name: 'You',
      sender_role: 'customer',
      status: 'pending',
    };

    if (retryId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === retryId ? { ...m, status: 'pending', errorDetails: undefined } : m))
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
            conversation_id: conversation.id,
            body: text,
            message_type: 'text',
            created_at: new Date().toISOString(),
            sender_id: currentUserId,
            sender_role: 'customer',
            sender_name: customerDisplayName || 'Customer',
          },
        });
      }
    } catch {
      // Fallback silently to HTTP persistence
    }

    try {
      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, message_type: 'text' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch message');
      }

      // Replace optimistic message with confirmed server record
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

      // If conversation was closed, update local conversation status to open
      if (conversation.status === 'closed' || conversation.status === 'resolved') {
        setConversation((prev) => (prev ? { ...prev, status: 'open' } : null));
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Delivery error';
      // Mark as failed in UI with retry option
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
    } finally {
      setIsSending(false);
    }
  };

  // Change conversation status (Resolve or Close)
  const handleUpdateStatus = async (newStatus: ConversationStatus) => {
    if (!conversation) return;
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      setConversation(data.conversation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change conversation status';
      setErrorBanner(msg);
    }
  };

  // Start a fresh conversation
  const handleStartNewConversation = async () => {
    setIsStartingNew(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'General Support' }),
      });
      if (!res.ok) throw new Error('Failed to create new conversation');
      const data = await res.json();
      setConversation(data.conversation);
      setMessages([]);
      setHasMore(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start new conversation';
      setErrorBanner(msg);
    } finally {
      setIsStartingNew(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Alert Banner if any */}
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

      {/* Main Chat Workspace Shell */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden flex flex-col h-[650px]">
        {/* Chat Header */}
        <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Support Team
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Verified Specialists
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                {conversation
                  ? `Thread #${conversation.id.slice(0, 8)} • ${conversation.subject || 'General Support'}`
                  : 'Starting support thread...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {conversation && (
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
            )}

            {/* Realtime Live Delivery Pill */}
            {conversation && (
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
                    : 'Offline - Falling back to persistent database sync'
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
            )}

            {conversation && conversation.status !== 'closed' && (
              <button
                type="button"
                onClick={() => handleUpdateStatus('resolved')}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1 transition-colors"
                title="Mark this conversation as resolved"
              >
                Mark Resolved
              </button>
            )}

            {conversation && (conversation.status === 'closed' || conversation.status === 'resolved') && (
              <button
                type="button"
                disabled={isStartingNew}
                onClick={handleStartNewConversation}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-lg px-2.5 py-1 transition-colors"
              >
                {isStartingNew ? 'Starting...' : 'New Chat'}
              </button>
            )}
          </div>
        </div>

        {/* Message Thread Scroll Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/30 dark:bg-neutral-950/20"
        >
          {/* Bounded Pagination Load Earlier Button */}
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

          {/* Empty Conversation State */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                How can we help today, {customerDisplayName}?
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm">
                Our support team is ready to assist you. Send a message below to start your conversation with a dedicated gaming specialist.
              </p>
            </div>
          )}

          {/* Messages Rendering */}
          {messages.map((msg) => {
            const isSelf = msg.is_self;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                {/* Sender Name & Role Label */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-neutral-400">
                  <span className="font-medium text-neutral-600 dark:text-neutral-300">
                    {msg.sender_name}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Bubble Container */}
                <div
                  className={`max-w-md rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words ${
                    isSelf
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-white border border-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white rounded-tl-xs'
                  }`}
                >
                  {/* Safe text rendering (no dangerous innerHTML) */}
                  {msg.body}
                </div>

                {/* Status indicator for outgoing messages (Messenger-style) */}
                {isSelf && (
                  <div className="mt-1 flex items-center gap-1 px-1 text-[10px] text-neutral-400">
                    {msg.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-neutral-400 dark:text-neutral-500" title="Sending...">
                        <Check className="h-3 w-3 text-neutral-400" />
                        <span>Sending</span>
                      </span>
                    )}

                    {msg.status === 'failed' && (
                      <div className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                        <XCircle className="h-3 w-3" />
                        <span>Failed to send</span>
                        <button
                          type="button"
                          onClick={() => handleSendMessage(msg.body, msg.id)}
                          className="inline-flex items-center gap-0.5 underline hover:text-red-700 ml-1"
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}

                    {(!msg.status || msg.status === 'sent') && (
                      <span className="inline-flex items-center gap-1 text-neutral-400 dark:text-neutral-500" title="Delivered">
                        <CheckCheck className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                        <span>Delivered</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Closed Thread Banner if closed */}
        {conversation && conversation.status === 'closed' && (
          <div className="bg-neutral-100 dark:bg-neutral-800 px-6 py-2.5 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300">
            <span>This conversation is closed. Sending a new message will automatically reopen it.</span>
            <button
              onClick={() => handleUpdateStatus('open')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Reopen Now
            </button>
          </div>
        )}

        {/* Message Input Bar (Never blocks user input - Instant Messenger feel) */}
        <div className="border-t border-neutral-200 p-4 bg-white dark:border-neutral-800 dark:bg-neutral-900">
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
                placeholder="Type your message to Support Team..."
                maxLength={5000}
                disabled={!conversation}
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
              disabled={!inputText.trim() || !conversation}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors shrink-0"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
