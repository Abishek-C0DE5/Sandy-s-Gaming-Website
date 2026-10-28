import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateInquirySchema = z.object({
  status: z.enum(['new', 'in_progress', 'replied', 'closed']).optional(),
  assigned_admin_id: z.string().uuid().nullable().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/contact-requests/[id] - Retrieve single inquiry with replies
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: Staff access required' }, { status: 403 });
  }

  const adminClient = await createAdminClient();

  // Fetch inquiry
  const { data: inquiry, error: inqError } = await adminClient
    .from('contact_inquiries')
    .select('*')
    .eq('id', id)
    .single();

  if (inqError || !inquiry) {
    return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
  }

  // Fetch replies
  const { data: replies } = await adminClient
    .from('contact_inquiry_replies')
    .select('*')
    .eq('inquiry_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ inquiry, replies: replies || [] });
}

// PATCH /api/admin/contact-requests/[id] - Update status or assignment
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: Staff access required' }, { status: 403 });
  }

  try {
    const json = await request.json();
    const parsed = updateInquirySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid update' }, { status: 400 });
    }

    const updates: import('@/types/database').Database['public']['Tables']['contact_inquiries']['Update'] = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };

    if (updates.status === 'closed') {
      updates.closed_at = new Date().toISOString();
    }

    const adminClient = await createAdminClient();

    const { data: updated, error: updateError } = await adminClient
      .from('contact_inquiries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || 'Failed to update inquiry' }, { status: 500 });
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'INQUIRY_UPDATED',
      target_type: 'contact_inquiry',
      target_id: id,
      metadata: updates,
    });

    return NextResponse.json({ success: true, inquiry: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error processing update';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
