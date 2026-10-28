import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, displayName } = body;

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const cleanDisplayName = typeof displayName === 'string' ? displayName.trim() : '';

    // Validation
    if (!cleanDisplayName || cleanDisplayName.length < 2 || cleanDisplayName.length > 50) {
      return NextResponse.json(
        { error: 'Display name must be between 2 and 50 characters.' },
        { status: 400 }
      );
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Database keys missing.' },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Create user in Supabase Auth
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        display_name: cleanDisplayName,
      },
    });

    if (createError) {
      const msg = createError.message.toLowerCase().includes('already registered')
        ? 'An account with this email address already exists. Please sign in.'
        : createError.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!newUser?.user) {
      return NextResponse.json(
        { error: 'Failed to create account.' },
        { status: 500 }
      );
    }

    // Ensure the profile row exists and has role 'customer'
    await adminClient.from('profiles').upsert(
      {
        id: newUser.user.id,
        email: cleanEmail,
        display_name: cleanDisplayName,
        role: 'customer',
        account_status: 'active',
      },
      { onConflict: 'id' }
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully.',
        userId: newUser.user.id,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal registration error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
