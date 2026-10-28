import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { broadcastConversationEvent } from '@/lib/realtime/broadcast';
import type { ConversationStatus, MessageType } from '@/types/database';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ConversationSummary {
  id: string;
  customer_id: string;
  status: ConversationStatus;
}

interface RawMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: MessageType;
  created_at: string;
  edited_at: string | null;
  sender?: { id: string; display_name: string; role: string } | null;
}

/**
 * Authorization helper for conversation access.
 */
async function authorizeParticipant(
  conversationId: string,
  userId: string,
  role: string
): Promise<{ authorized: boolean; conversation?: ConversationSummary; isCustomerOwner?: boolean }> {
  const supabase = await createClient();

  const { data: conv, error } = await supabase
    .from('conversations')
    .select('id, customer_id, status')
    .eq('id', conversationId)
    .single();

  if (error || !conv) {
    return { authorized: false };
  }

  if (role === 'super_admin') {
    return { authorized: true, conversation: conv };
  }

  if (role === 'customer') {
    if (conv.customer_id === userId) {
      return { authorized: true, conversation: conv, isCustomerOwner: true };
    }
    return { authorized: false };
  }

  if (role === 'admin') {
    const { data: assignment } = await supabase
      .from('conversation_assignments')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('admin_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (assignment) {
      return { authorized: true, conversation: conv };
    }
  }

  return { authorized: false };
}

/**
 * GET /api/conversations/[id]/messages
 * Bounded pagination and role-aware sender identification:
 * - Customers see their messages as "You", and all staff messages as "Support Team".
 * - Staff sees real sender display names and roles.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.account_status === 'suspended') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { authorized, conversation } = await authorizeParticipant(id, user.id, profile.role);
  if (!authorized || !conversation) {
    return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  // Bounded pagination: min 1, max 100, default 50
  const limitParam = parseInt(searchParams.get('limit') || '50', 10);
  const limit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 100);
  const before = searchParams.get('before'); // ISO timestamp cursor

  // Build messages query
  let query = supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      body,
      message_type,
      created_at,
      edited_at,
      sender:profiles!messages_sender_id_fkey(id, display_name, role)
    `)
    .eq('conversation_id', id);

  if (before) {
    query = query.lt('created_at', before);
  }

  // Fetch newest messages up to limit
  const { data: messages, error: msgsError } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (msgsError) {
    return NextResponse.json({ error: msgsError.message }, { status: 500 });
  }

  // Reverse so the returned array is in stable ascending chronological order
  const chronological = ((messages as unknown as RawMessageRow[]) || []).reverse();

  // Role-aware identity masking
  const isCustomerViewer = profile.role === 'customer';

  const sanitizedMessages = chronological.map((msg) => {
    const isSelf = msg.sender_id === user.id;
    const senderProfile = msg.sender;

    if (isCustomerViewer) {
      // REQUIREMENT 11: Customer views MUST map staff messages to generic "Support Team"
      // and hide individual staff IDs and display names.
      if (isSelf) {
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          body: msg.body,
          message_type: msg.message_type,
          created_at: msg.created_at,
          edited_at: msg.edited_at,
          is_self: true,
          sender_name: 'You',
          sender_role: 'customer',
        };
      }

      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        body: msg.body,
        message_type: msg.message_type,
        created_at: msg.created_at,
        edited_at: msg.edited_at,
        is_self: false,
        sender_name: 'Support Team',
        sender_role: 'staff',
      };
    }

    // STAFF VIEWER (Admin / Super Admin): Real sender identity preserved
    const senderRole = senderProfile?.role || 'staff';
    const senderName = isSelf
      ? 'You'
      : senderProfile?.display_name || (senderRole === 'customer' ? 'Customer' : 'Specialist');

    return {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      body: msg.body,
      message_type: msg.message_type,
      created_at: msg.created_at,
      edited_at: msg.edited_at,
      is_self: isSelf,
      sender_name: senderName,
      sender_role: senderRole,
    };
  });

  return NextResponse.json({
    conversation_id: id,
    status: conversation.status,
    messages: sanitizedMessages,
    has_more: (messages?.length ?? 0) === limit,
  });
}

/**
 * POST /api/conversations/[id]/messages
 * Secure message dispatch:
 * - Derives sender strictly from authenticated session (user.id).
 * - Enforces length boundaries (1 - 5000 characters).
 * - Prevents rapid accidental duplicate submissions.
 * - Updates conversation.last_message_at via PostgreSQL trigger.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.account_status === 'suspended') {
    return NextResponse.json({ error: 'Forbidden: Account is inactive or suspended' }, { status: 403 });
  }

  const { authorized, conversation } = await authorizeParticipant(id, user.id, profile.role);
  if (!authorized || !conversation) {
    return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
  }

  let bodyData: Record<string, unknown> = {};
  try {
    bodyData = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  // 1. Content validation
  const rawBody = typeof bodyData.body === 'string' ? bodyData.body : '';
  const trimmedBody = rawBody.trim();

  if (trimmedBody.length === 0) {
    return NextResponse.json({ error: 'Message body cannot be empty' }, { status: 400 });
  }

  if (trimmedBody.length > 5000) {
    return NextResponse.json({ error: 'Message body cannot exceed 5000 characters' }, { status: 400 });
  }

  const allowedTypes: MessageType[] = ['text', 'system', 'media'];
  const messageType: MessageType = allowedTypes.includes(bodyData.message_type as MessageType)
    ? (bodyData.message_type as MessageType)
    : 'text';

  // 2. Duplicate submission safeguard:
  // If the same user sent the exact same body in this conversation in the last 3 seconds,
  // return the recent message idempotently rather than duplicating it.
  const threeSecondsAgo = new Date(Date.now() - 3000).toISOString();
  const { data: recentDuplicate } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, message_type, created_at, edited_at')
    .eq('conversation_id', id)
    .eq('sender_id', user.id)
    .eq('body', trimmedBody)
    .gte('created_at', threeSecondsAgo)
    .maybeSingle();

  if (recentDuplicate) {
    return NextResponse.json(
      {
        message: {
          ...recentDuplicate,
          is_self: true,
          sender_name: 'You',
          sender_role: profile.role === 'customer' ? 'customer' : 'staff',
        },
        duplicate_prevented: true,
      },
      { status: 200 }
    );
  }

  // 3. Reopen closed conversation if customer posts a new message
  if (conversation.status === 'closed' && profile.role === 'customer') {
    await supabase
      .from('conversations')
      .update({ status: 'open', closed_at: null })
      .eq('id', id);
  }

  // 4. Secure insert: Sender derived STRICTLY from server session (user.id)
  const { data: insertedMessage, error: insertError } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      sender_id: user.id, // Authenticated session ID ONLY
      body: trimmedBody,
      message_type: messageType,
    })
    .select('id, conversation_id, sender_id, body, message_type, created_at, edited_at')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 5. Broadcast message via Realtime channel (Dual-path delivery alongside DB trigger)
  const isCustomerSender = profile.role === 'customer';
  const broadcastPayload = {
    id: insertedMessage.id,
    conversation_id: insertedMessage.conversation_id,
    body: insertedMessage.body,
    message_type: insertedMessage.message_type,
    created_at: insertedMessage.created_at,
    sender_id: insertedMessage.sender_id,
    sender_role: profile.role,
    // Customer-facing name is masked to 'Support Team' for staff; staff view sees actual display name
    sender_name: isCustomerSender ? (profile.display_name || 'Customer') : 'Support Team',
    true_sender_name: profile.display_name || 'Staff Member',
  };

  // Asynchronous broadcast dispatch (non-blocking for HTTP response)
  broadcastConversationEvent(id, 'new_message', broadcastPayload).catch((err) => {
    console.error('[Messages Route] Realtime broadcast error (non-fatal):', err);
  });

  return NextResponse.json(
    {
      message: {
        ...insertedMessage,
        is_self: true,
        sender_name: 'You',
        sender_role: profile.role === 'customer' ? 'customer' : 'staff',
      },
    },
    { status: 201 }
  );
}
