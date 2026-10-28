import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL('/', request.url);
  return NextResponse.redirect(url, {
    status: 302,
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL('/', request.url);
  return NextResponse.redirect(url, {
    status: 302,
  });
}
