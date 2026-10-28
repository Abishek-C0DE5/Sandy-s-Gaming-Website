import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';

/**
 * GET /api/conversations
 * - Customer: Retrieves active conversation or customer's conversation list.
 * - Admin: Retrieves active conversations assigned to this admin.
 * - Super Admin: Retrieves all system conversations with assigned staff information.
 */
export async function GET(req: NextRequest) {
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
    return NextResponse.json({ error: 'Account suspended or profile not found' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode'); // 'active' | 'all'

  // CUSTOMER FLOW
  if (profile.role === 'customer') {
    if (mode === 'active' || !mode) {
      // Find latest active conversation (open or in_progress)
      const { data: activeConv, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('customer_id', user.id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convError) {
        return NextResponse.json({ error: convError.message }, { status: 500 });
      }

      // If active conversation found, return it
      if (activeConv) {
        return NextResponse.json({ conversation: activeConv });
      }

      // If no active conversation exists and auto_create is requested or default
      const autoCreate = searchParams.get('auto_create') !== 'false';
      if (autoCreate) {
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            customer_id: user.id,
            subject: 'General Support',
            status: 'open',
          })
          .select()
          .single();

        if (createError) {
          return NextResponse.json({ error: createError.message }, { status: 500 });
        }
        return NextResponse.json({ conversation: newConv, is_new: true });
      }

      return NextResponse.json({ conversation: null });
    }

    // mode === 'all'
    const { data: allConvs, error: allConvsError } = await supabase
      .from('conversations')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (allConvsError) {
      return NextResponse.json({ error: allConvsError.message }, { status: 500 });
    }
    return NextResponse.json({ conversations: allConvs });
  }

  // ADMIN FLOW (Only actively assigned conversations)
  if (profile.role === 'admin') {
    const { data: assignments, error: assignError } = await supabase
      .from('conversation_assignments')
      .select('conversation_id')
      .eq('admin_id', user.id)
      .eq('status', 'active');

    if (assignError) {
      return NextResponse.json({ error: assignError.message }, { status: 500 });
    }

    const convIds = assignments.map((a) => a.conversation_id);
    if (convIds.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    const { data: convs, error: convsError } = (await supabase
      .from('conversations')
      .select('*, customer:profiles!conversations_customer_id_fkey(id, display_name, role)')
      .in('id', convIds)
      .order('last_message_at', { ascending: false })) as {
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    };

    if (convsError) {
      return NextResponse.json({ error: convsError.message }, { status: 500 });
    }

    return NextResponse.json({ conversations: convs });
  }

  // SUPER ADMIN FLOW (Global oversight)
  if (profile.role === 'super_admin') {
    const { data: convs, error: convsError } = (await supabase
      .from('conversations')
      .select(`
        *,
        customer:profiles!conversations_customer_id_fkey(id, display_name, role),
        assignments:conversation_assignments(
          id,
          admin_id,
          status,
          admin:profiles!conversation_assignments_admin_id_fkey(id, display_name, role)
        )
      `)
      .order('last_message_at', { ascending: false })) as {
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    };

    if (convsError) {
      return NextResponse.json({ error: convsError.message }, { status: 500 });
    }

    return NextResponse.json({ conversations: convs });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST /api/conversations
 * - Customer initiates a new conversation thread.
 */
export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'Account suspended or profile not found' }, { status: 403 });
  }

  let bodyData: { subject?: string; initial_message?: string } = {};
  try {
    bodyData = await req.json();
  } catch {
    // Empty body is acceptable
  }

  const subject = (bodyData.subject?.trim() || 'General Support').slice(0, 100);

  // Create conversation record
  const { data: conversation, error: createError } = await supabase
    .from('conversations')
    .insert({
      customer_id: user.id,
      subject,
      status: 'open',
    })
    .select()
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // If initial message provided, insert it
  let firstMessage = null;
  if (bodyData.initial_message && bodyData.initial_message.trim().length > 0) {
    const trimmedMsg = bodyData.initial_message.trim().slice(0, 5000);
    const { data: msg, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        body: trimmedMsg,
        message_type: 'text',
      })
      .select()
      .single();

    if (!msgError) {
      firstMessage = msg;
    }
  }

  return NextResponse.json(
    {
      conversation,
      message: firstMessage,
    },
    { status: 201 }
  );
}
