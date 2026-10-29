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

  // Send a new message (Non-blocking background delivery)
  const handleSendMessage = async (textToSend?: string, retryId?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || !conversation) return;

    if (text.length > 5000) {
      setErrorBanner('Message is too long. Limit is 5000 characters.');
      return;
    }

    setErrorBanner(null);

    // Create temporary optimistic message (instantly marked 'sent' in UI)
    // eslint-disable-next-line react-hooks/purity
    const tempId = retryId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversation_id: conversation.id,
      body: text,
      message_type: 'text',
      created_at: new Date().toISOString(),
      is_self: true,
      sender_name: 'You',
      sender_role: 'customer',
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

    // Perform background database persistence
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
        <div className="flex items-center justify-between rounded-xl bg-red-950/30 p-4 border border-red-500/30 text-red-300 text-xs backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-red-400 hover:text-red-300 font-semibold text-xs ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Chat Workspace Shell */}
      <div className="rounded-3xl glass-elevated overflow-hidden flex flex-col h-[650px]">
        {/* Chat Header */}
        <div className="border-b border-white/[0.06] bg-white/[0.02] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-white shadow-[0_0_20px_rgba(215,25,50,0.4)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Support Team
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full glass px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Verified Specialists
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                {conversation
                  ? `Thread #${conversation.id.slice(0, 8)} • ${conversation.subject || 'General Support'}`
                  : 'Starting support thread...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {conversation && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize glass ${
                  conversation.status === 'open'
                    ? 'text-emerald-400 border-emerald-500/30'
                    : conversation.status === 'in_progress'
                    ? 'text-amber-400 border-amber-500/30'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {conversation.status.replace('_', ' ')}
              </span>
            )}

            {/* Realtime Live Delivery Pill */}
            {conversation && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium glass ${
                  realtimeStatus === 'connected'
                    ? 'text-emerald-400 border-emerald-500/30'
                    : realtimeStatus === 'connecting'
                    ? 'text-amber-400 border-amber-500/30'
                    : 'text-[var(--text-muted)]'
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
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <Wifi className="h-2.5 w-2.5" />
                    <span>Live</span>
                  </>
                ) : realtimeStatus === 'connecting' ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
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
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-white glass rounded-xl px-3 py-1 transition-all duration-300"
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
                className="btn-primary text-xs font-semibold text-white rounded-xl px-3 py-1"
              >
                {isStartingNew ? 'Starting...' : 'New Chat'}
              </button>
            )}
          </div>
        </div>

        {/* Message Thread Scroll Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/20"
        >
          {/* Bounded Pagination Load Earlier Button */}
          {hasMore && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                disabled={isLoadingMore}
                onClick={handleLoadEarlier}
                className="inline-flex items-center gap-1.5 rounded-full glass px-3.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-all duration-300"
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
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl glass text-[var(--brand-primary)] animate-float">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                How can we help today, {customerDisplayName}?
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm leading-relaxed">
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
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} animate-fade-up`}
              >
                {/* Sender Name & Role Label */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text-secondary)]">
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
                  className={`max-w-md rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words transition-all duration-300 ${
                    isSelf
                      ? 'bg-gradient-to-r from-[var(--brand-primary)] to-[#b01328] text-white rounded-tr-xs shadow-[0_4px_20px_rgba(215,25,50,0.3)]'
                      : 'glass-elevated text-[var(--text-primary)] rounded-tl-xs'
                  }`}
                >
                  {/* Safe text rendering (no dangerous innerHTML) */}
                  {msg.body}
                </div>

                {/* Status indicator: only display if transmission failed with retry button */}
                {isSelf && msg.status === 'failed' && (
                  <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-red-400 font-medium">
                    <XCircle className="h-3 w-3" />
                    <span>Failed to send</span>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(msg.body, msg.id)}
                      className="inline-flex items-center gap-0.5 underline hover:text-red-300 ml-1"
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

        {/* Closed Thread Banner if closed */}
        {conversation && conversation.status === 'closed' && (
          <div className="glass px-6 py-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>This conversation is closed. Sending a new message will automatically reopen it.</span>
            <button
              onClick={() => handleUpdateStatus('open')}
              className="text-xs font-semibold text-[var(--brand-primary)] hover:underline ml-2"
            >
              Reopen Now
            </button>
          </div>
        )}

        {/* Message Input Bar (Never blocks user input - Instant Messenger feel) */}
        <div className="border-t border-white/[0.06] p-4 bg-white/[0.01]">
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
                className="w-full rounded-xl border border-white/[0.08] bg-[var(--surface-secondary)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]/30 disabled:opacity-50 transition-all duration-300"
              />
              {inputText.length > 3000 && (
                <span className="absolute right-3 top-3.5 text-[10px] font-mono text-[var(--text-muted)]">
                  {inputText.length}/5000
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || !conversation}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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
