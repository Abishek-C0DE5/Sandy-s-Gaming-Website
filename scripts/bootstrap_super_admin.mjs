import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local safely
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const targetEmail = process.argv[2]?.trim().toLowerCase();

if (!targetEmail || !targetEmail.includes('@')) {
  console.log(`
Usage:
  node scripts/bootstrap_super_admin.mjs <target-email>

Example:
  node scripts/bootstrap_super_admin.mjs superadmin@yourdomain.com
`);
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function bootstrap() {
  console.log(`Checking profile for: ${targetEmail}...`);

  // Check if profile exists
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, email, role, display_name')
    .eq('email', targetEmail)
    .maybeSingle();

  if (profile) {
    if (profile.role === 'super_admin') {
      console.log(`User ${targetEmail} is ALREADY a super_admin! (User ID: ${profile.id})`);
      process.exit(0);
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ role: 'super_admin', updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (updateError) {
      console.error(`Failed to promote user to super_admin: ${updateError.message}`);
      process.exit(1);
    }

    console.log(`🎉 SUCCESS: User ${targetEmail} (ID: ${profile.id}) has been promoted to 'super_admin'!`);
    process.exit(0);
  }

  // If user does not exist in auth yet, create them via auth.admin API
  console.log(`User ${targetEmail} not found in profiles. Provisioning new auth account...`);
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email: targetEmail,
    email_confirm: true,
    user_metadata: { display_name: 'Super Admin' },
  });

  if (createError) {
    console.error(`Failed to provision auth user: ${createError.message}`);
    process.exit(1);
  }

  // Ensure profile is updated to super_admin
  const { error: roleError } = await adminClient
    .from('profiles')
    .update({ role: 'super_admin', updated_at: new Date().toISOString() })
    .eq('id', newUser.user.id);

  if (roleError) {
    console.error(`User created, but role assignment failed: ${roleError.message}`);
    process.exit(1);
  }

  console.log(`🎉 SUCCESS: Created account ${targetEmail} (ID: ${newUser.user.id}) and granted 'super_admin' role!`);
}

bootstrap().catch(console.error);
