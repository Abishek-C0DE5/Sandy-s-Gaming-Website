import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEmailAdapter } from '@/lib/email/adapter';

export async function GET() {
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

  const emailAdapter = getEmailAdapter();

  return NextResponse.json({
    isConfigured: emailAdapter.isConfigured,
    provider: emailAdapter.name,
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'support@sandysgaming.com',
    fromName: process.env.EMAIL_FROM_NAME || "Sandy's Gaming Support",
  });
}
