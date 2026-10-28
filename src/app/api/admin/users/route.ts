import { createAdminClient, createClient } from '@/lib/supabase/server';
import { broadcastConversationEvent } from '@/lib/realtime/broadcast';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const provisionUserSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  displayName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  role: z.enum(['admin', 'super_admin', 'customer']),
});

const updateRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['admin', 'super_admin', 'customer']),
  accountStatus: z.enum(['active', 'suspended', 'pending']).optional(),
});

// GET /api/admin/users - List users (Super Admin only)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (callerProfile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
  }

  const adminClient = await createAdminClient();
  const { data: users, error } = await adminClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users });
}

// POST /api/admin/users - Provision or invite an admin user (Super Admin only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (callerProfile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
  }

  const json = await request.json();
  const parsed = provisionUserSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { email, displayName, role } = parsed.data;
  const adminClient = await createAdminClient();

  // Check if profile already exists
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile) {
    // Update existing user role
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ role, display_name: displayName, updated_at: new Date().toISOString() })
      .eq('id', existingProfile.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log audit event
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'USER_ROLE_PROMOTED',
      target_type: 'profile',
      target_id: existingProfile.id,
      metadata: { new_role: role, email },
    });

    return NextResponse.json({ message: 'User role updated successfully', userId: existingProfile.id });
  }

  // Create new user via Supabase admin auth
  const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (authError || !newAuthUser.user) {
    return NextResponse.json({ error: authError?.message || 'Failed to create user' }, { status: 500 });
  }

  // Ensure role is updated in profiles
  const { error: roleError } = await adminClient
    .from('profiles')
    .update({ role, display_name: displayName })
    .eq('id', newAuthUser.user.id);

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  // Log audit event
  await adminClient.from('audit_logs').insert({
    actor_id: user.id,
    action: 'USER_PROVISIONED',
    target_type: 'profile',
    target_id: newAuthUser.user.id,
    metadata: { role, email, display_name: displayName },
  });

  return NextResponse.json({
    message: 'Staff account successfully provisioned',
    userId: newAuthUser.user.id,
  });
}

// PATCH /api/admin/users - Modify role or account status (Super Admin only)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (callerProfile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
  }

  const json = await request.json();
  const parsed = updateRoleSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { userId, role, accountStatus } = parsed.data;

  // Protect against accidental self-lockout: Super Admins cannot demote or suspend their own account
  if (userId === user.id) {
    if (role !== 'super_admin' || accountStatus === 'suspended') {
      return NextResponse.json(
        { error: 'Forbidden: Super Admins cannot demote or suspend their own account to prevent lockout' },
        { status: 400 }
      );
    }
  }

  const adminClient = await createAdminClient();

  // Fetch current user details to compare changes
  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('id, email, display_name, role, account_status')
    .eq('id', userId)
    .single();

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const updates: import('@/types/database').Database['public']['Tables']['profiles']['Update'] = {
    role,
    updated_at: new Date().toISOString(),
  };

  if (accountStatus) {
    updates.account_status = accountStatus;
  }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const isSuspension = accountStatus === 'suspended' && targetProfile.account_status !== 'suspended';
  const isReactivation = accountStatus === 'active' && targetProfile.account_status === 'suspended';
  const isRoleChange = role !== targetProfile.role;

  // 1. Account Disabling: Revoke active conversation assignments and invalidate active sessions
  if (isSuspension) {
    // Invalidate all active assignments in PostgreSQL
    const { data: activeAssignments } = await adminClient
      .from('conversation_assignments')
      .select('id, conversation_id')
      .eq('admin_id', userId)
      .eq('status', 'active');

    if (activeAssignments && activeAssignments.length > 0) {
      const removedAt = new Date().toISOString();
      for (const assignment of activeAssignments) {
        await adminClient
          .from('conversation_assignments')
          .update({ status: 'removed', removed_at: removedAt })
          .eq('id', assignment.id);

        // Record audit event for unassignment
        await adminClient.from('audit_logs').insert({
          actor_id: user.id,
          action: 'CONVERSATION_UNASSIGNED',
          target_type: 'conversation_assignment',
          target_id: assignment.id,
          metadata: {
            conversation_id: assignment.conversation_id,
            admin_id: userId,
            reason: 'admin_account_suspended',
            removed_by: user.id,
            timestamp: removedAt,
          },
        });

        // Broadcast assignment_revoked over Realtime
        broadcastConversationEvent(assignment.conversation_id, 'assignment_revoked', {
          conversation_id: assignment.conversation_id,
          admin_id: userId,
          removed_by: user.id,
          revoked_at: removedAt,
        }).catch((err) => {
          console.error('[Admin Users] Failed to broadcast assignment_revoked on suspension:', err);
        });
      }
    }

    // Invalidate active auth sessions globally
    try {
      await adminClient.auth.admin.signOut(userId, 'global');
    } catch (signOutErr) {
      console.warn('[Admin Users] Failed to globally sign out suspended user:', signOutErr);
    }

    // Record audit event for suspension
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'USER_ACCOUNT_SUSPENDED',
      target_type: 'profile',
      target_id: userId,
      metadata: {
        email: targetProfile.email,
        display_name: targetProfile.display_name,
        previous_status: targetProfile.account_status,
        revoked_assignments_count: activeAssignments?.length || 0,
      },
    });
  } else if (isReactivation) {
    // Record audit event for reactivation
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'USER_ACCOUNT_REACTIVATED',
      target_type: 'profile',
      target_id: userId,
      metadata: {
        email: targetProfile.email,
        display_name: targetProfile.display_name,
      },
    });
  }

  // 2. Role Change Audit Log
  if (isRoleChange) {
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: role === 'super_admin' ? 'USER_ROLE_PROMOTED' : 'USER_ROLE_DEMOTED',
      target_type: 'profile',
      target_id: userId,
      metadata: {
        email: targetProfile.email,
        previous_role: targetProfile.role,
        new_role: role,
      },
    });
  }

  return NextResponse.json({
    message: isSuspension
      ? 'Staff account suspended and active assignments revoked'
      : isReactivation
      ? 'Staff account reactivated successfully'
      : 'User updated successfully',
  });
}
