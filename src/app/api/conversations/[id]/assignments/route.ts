import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { broadcastConversationEvent } from '@/lib/realtime/broadcast';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface AssignedStaffRecord {
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

/**
 * GET /api/conversations/[id]/assignments
 * Retrieves current active assignments and assignment history for a conversation.
 * Accessible to authorized staff (assigned admin or super_admin).
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Unauthorized: Staff access required' }, { status: 403 });
  }

  // If regular admin, verify active assignment to this conversation
  if (profile.role === 'admin') {
    const { data: userAssignment } = await supabase
      .from('conversation_assignments')
      .select('id')
      .eq('conversation_id', id)
      .eq('admin_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!userAssignment) {
      return NextResponse.json({ error: 'Access denied: You are not assigned to this conversation' }, { status: 403 });
    }
  }

  // Query all assignments (both active and removed history)
  const { data: assignments, error } = await supabase
    .from('conversation_assignments')
    .select(`
      id,
      conversation_id,
      admin_id,
      assigned_by,
      status,
      assigned_at,
      removed_at,
      admin:profiles!conversation_assignments_admin_id_fkey(id, display_name, role),
      assigner:profiles!conversation_assignments_assigned_by_fkey(id, display_name, role)
    `)
    .eq('conversation_id', id)
    .order('assigned_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const typedAssignments = (assignments as unknown as AssignedStaffRecord[]) || [];
  const active = typedAssignments.filter((a) => a.status === 'active');
  const history = typedAssignments.filter((a) => a.status === 'removed');

  return NextResponse.json({
    conversation_id: id,
    active_assignments: active,
    assignment_history: history,
  });
}

/**
 * POST /api/conversations/[id]/assignments
 * Only authorized Super Admin can assign an admin to a conversation.
 * Validates active admin status, prevents duplicate active assignments, and records audit trail.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const adminId = typeof body.admin_id === 'string' ? body.admin_id.trim() : '';

  if (!adminId) {
    return NextResponse.json({ error: 'admin_id is required' }, { status: 400 });
  }

  // 1. Verify target conversation exists
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, subject, customer_id')
    .eq('id', id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // 2. Validate target account: Must be an ACTIVE admin or super_admin
  const { data: targetProfile, error: targetError } = await supabase
    .from('profiles')
    .select('id, display_name, role, account_status')
    .eq('id', adminId)
    .single();

  if (targetError || !targetProfile) {
    return NextResponse.json({ error: 'Target staff member not found' }, { status: 404 });
  }

  if (targetProfile.role !== 'admin' && targetProfile.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Cannot assign non-staff member. Target user must have admin role.' },
      { status: 400 }
    );
  }

  if (targetProfile.account_status !== 'active') {
    return NextResponse.json(
      { error: `Cannot assign admin with account status "${targetProfile.account_status}". Must be active.` },
      { status: 400 }
    );
  }

  // 3. Prevent duplicate active assignment (Backend validation + DB partial unique index)
  const { data: existingAssignment } = await supabase
    .from('conversation_assignments')
    .select('id, status')
    .eq('conversation_id', id)
    .eq('admin_id', adminId)
    .eq('status', 'active')
    .maybeSingle();

  if (existingAssignment) {
    return NextResponse.json(
      { error: 'Admin is already actively assigned to this conversation' },
      { status: 409 }
    );
  }

  // 4. Insert active assignment
  const { data: newAssignment, error: insertError } = await supabase
    .from('conversation_assignments')
    .insert({
      conversation_id: id,
      admin_id: adminId,
      assigned_by: profile.id,
      status: 'active',
      assigned_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 5. Record immutable audit log event
  await supabase.from('audit_logs').insert({
    actor_id: profile.id,
    action: 'CONVERSATION_ASSIGNED',
    target_type: 'conversation_assignment',
    target_id: newAssignment.id,
    metadata: {
      conversation_id: id,
      admin_id: adminId,
      admin_name: targetProfile.display_name,
      assigned_by: profile.id,
      timestamp: new Date().toISOString(),
    },
  });

  // 6. Broadcast assignment_added event to conversation channel
  broadcastConversationEvent(id, 'assignment_added', {
    conversation_id: id,
    admin_id: adminId,
    admin_name: targetProfile.display_name,
    assigned_at: newAssignment.assigned_at,
  }).catch((err) => {
    console.error('[Assignments Route] Broadcast assignment_added error:', err);
  });

  return NextResponse.json(
    {
      assignment: newAssignment,
      admin: {
        id: targetProfile.id,
        display_name: targetProfile.display_name,
        role: targetProfile.role,
      },
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/conversations/[id]/assignments
 * Super Admin removes an admin assignment.
 * Updates status to 'removed', sets removed_at, and writes an audit event.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized: Super Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const adminId = searchParams.get('admin_id');

  if (!adminId) {
    return NextResponse.json({ error: 'admin_id parameter is required' }, { status: 400 });
  }

  // Check active assignment
  const { data: targetAssignment } = await supabase
    .from('conversation_assignments')
    .select('id, admin_id')
    .eq('conversation_id', id)
    .eq('admin_id', adminId)
    .eq('status', 'active')
    .maybeSingle();

  if (!targetAssignment) {
    return NextResponse.json(
      { error: 'No active assignment found for the specified admin in this conversation' },
      { status: 404 }
    );
  }

  const removedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('conversation_assignments')
    .update({
      status: 'removed',
      removed_at: removedAt,
    })
    .eq('id', targetAssignment.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Write immutable audit log event
  await supabase.from('audit_logs').insert({
    actor_id: profile.id,
    action: 'CONVERSATION_UNASSIGNED',
    target_type: 'conversation_assignment',
    target_id: targetAssignment.id,
    metadata: {
      conversation_id: id,
      admin_id: adminId,
      removed_by: profile.id,
      removed_at: removedAt,
      timestamp: removedAt,
    },
  });

  // Broadcast assignment_revoked event to conversation channel
  broadcastConversationEvent(id, 'assignment_revoked', {
    conversation_id: id,
    admin_id: adminId,
    removed_by: profile.id,
    revoked_at: removedAt,
  }).catch((err) => {
    console.error('[Assignments Route] Broadcast assignment_revoked error:', err);
  });

  return NextResponse.json({
    success: true,
    unassigned: {
      assignment_id: targetAssignment.id,
      admin_id: adminId,
      removed_at: removedAt,
    },
  });
}
