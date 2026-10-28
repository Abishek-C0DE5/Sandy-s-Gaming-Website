import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { broadcastConversationEvent } from '@/lib/realtime/broadcast';
import type { ConversationStatus } from '@/types/database';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ConversationRecord {
  id: string;
  customer_id: string;
  subject: string | null;
  status: ConversationStatus;
  last_message_at: string;
  created_at: string;
  closed_at: string | null;
  customer?: { id: string; display_name: string; role: string } | null;
}

interface AssignedStaffRecord {
  id: string;
  admin_id: string;
  status: string;
  assigned_at: string;
  admin?: { id: string; display_name: string; role: string } | null;
}

/**
 * Validates whether the caller has access to the conversation:
 * - Customer: Must be conversation owner (`customer_id === user.id`)
 * - Admin: Must be actively assigned (`conversation_assignments.status === 'active'`)
 * - Super Admin: Unrestricted global access
 */
async function authorizeConversation(
  conversationId: string,
  userId: string,
  role: string
): Promise<{ authorized: boolean; conversation?: ConversationRecord; isOwner?: boolean }> {
  const supabase = await createClient();

  // Fetch the conversation record
  const { data: conv, error: convError } = (await supabase
    .from('conversations')
    .select(`
      *,
      customer:profiles!conversations_customer_id_fkey(id, display_name, role)
    `)
    .eq('id', conversationId)
    .single()) as { data: ConversationRecord | null; error: { message: string } | null };

  if (convError || !conv) {
    return { authorized: false };
  }

  if (role === 'super_admin') {
    return { authorized: true, conversation: conv };
  }

  if (role === 'customer') {
    if (conv.customer_id === userId) {
      return { authorized: true, conversation: conv, isOwner: true };
    }
    return { authorized: false };
  }

  if (role === 'admin') {
    // Check active assignment
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
 * GET /api/conversations/[id]
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

  const { authorized, conversation } = await authorizeConversation(id, user.id, profile.role);
  if (!authorized) {
    return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
  }

  // If staff, also retrieve assigned admins list
  let assignedStaff: AssignedStaffRecord[] = [];
  if (profile.role === 'admin' || profile.role === 'super_admin') {
    const { data: assignments } = await supabase
      .from('conversation_assignments')
      .select(`
        id,
        admin_id,
        status,
        assigned_at,
        admin:profiles!conversation_assignments_admin_id_fkey(id, display_name, role)
      `)
      .eq('conversation_id', id)
      .eq('status', 'active');

    assignedStaff = (assignments as unknown as AssignedStaffRecord[]) || [];
  }

  return NextResponse.json({
    conversation,
    assigned_staff: assignedStaff,
  });
}

/**
 * PATCH /api/conversations/[id]
 * Updates status (e.g., 'open', 'in_progress', 'resolved', 'closed')
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
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

  const { authorized, conversation, isOwner } = await authorizeConversation(id, user.id, profile.role);
  if (!authorized || !conversation) {
    return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
  }

  const body = (await req.json()) as { status?: ConversationStatus };
  const nextStatus = body.status as ConversationStatus;

  const validStatuses: ConversationStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
  if (!nextStatus || !validStatuses.includes(nextStatus)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
  }

  // Customers can resolve or close their own conversation, or reopen an open one
  if (profile.role === 'customer' && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updatePayload: { status: ConversationStatus; closed_at?: string | null } = {
    status: nextStatus,
  };

  if (nextStatus === 'closed' || nextStatus === 'resolved') {
    updatePayload.closed_at = new Date().toISOString();
  } else if (conversation.status === 'closed' && (nextStatus === 'open' || nextStatus === 'in_progress')) {
    updatePayload.closed_at = null;
  }

  const { data: updated, error: updateError } = await supabase
    .from('conversations')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Broadcast status change event to participants
  broadcastConversationEvent(id, 'status_changed', {
    conversation_id: id,
    status: updated.status,
    updated_at: new Date().toISOString(),
  }).catch((err) => {
    console.error('[Conversations Route] Broadcast status_changed error:', err);
  });

  return NextResponse.json({ conversation: updated });
}
