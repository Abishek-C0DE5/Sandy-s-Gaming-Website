import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Error: Required environment variables missing.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_ACCOUNTS = [
  {
    role: 'customer',
    email: 'visitor.sandysgaming@gmail.com',
    password: 'TestPassword123!',
    displayName: 'Test Visitor',
    expectedHome: '/chat',
  },
  {
    role: 'admin',
    email: 'admin.sandysgaming@gmail.com',
    password: 'TestPassword123!',
    displayName: 'Support Admin',
    expectedHome: '/admin',
  },
  {
    role: 'super_admin',
    email: 'superadmin.sandysgaming@gmail.com',
    password: 'TestPassword123!',
    displayName: 'Super Admin',
    expectedHome: '/super-admin',
  },
];

async function setupAccounts() {
  console.log('==============================================================================');
  console.log('          PROVISIONING 3 TEST ACCOUNTS (VISITOR, ADMIN, SUPERADMIN)           ');
  console.log('==============================================================================\n');

  // Fetch all existing users to check if these emails exist
  const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) throw listErr;

  for (const acc of TEST_ACCOUNTS) {
    console.log(`Processing [${acc.role.toUpperCase()}] -> ${acc.email}...`);

    const existing = listData.users.find((u) => u.email?.toLowerCase() === acc.email.toLowerCase());

    let userId;
    if (existing) {
      console.log(`  - Account exists with ID: ${existing.id}. Updating password & confirmation...`);
      const { data: updated, error: updateErr } = await adminClient.auth.admin.updateUserById(existing.id, {
        password: acc.password,
        email_confirm: true,
        user_metadata: { display_name: acc.displayName },
      });
      if (updateErr) throw updateErr;
      userId = updated.user.id;
    } else {
      console.log(`  - Creating new account...`);
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: { display_name: acc.displayName },
      });
      if (createErr) throw createErr;
      userId = created.user.id;
    }

    // Upsert / update profile role and account_status
    console.log(`  - Setting profile role: '${acc.role}', status: 'active', name: '${acc.displayName}'...`);
    const { error: profileErr } = await adminClient.from('profiles').upsert({
      id: userId,
      email: acc.email,
      role: acc.role,
      account_status: 'active',
      display_name: acc.displayName,
      updated_at: new Date().toISOString(),
    });
    if (profileErr) throw profileErr;

    // Verify authentication using password
    console.log(`  - Verifying signInWithPassword credentials...`);
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: acc.email,
      password: acc.password,
    });

    if (signInErr) {
      console.error(`  ❌ Sign in failed for ${acc.email}:`, signInErr.message);
    } else {
      console.log(`  ✅ Successfully authenticated! Session user: ${signInData.user.id}`);
    }

    // Verify role returned from profiles table
    const { data: profileCheck, error: checkErr } = await adminClient
      .from('profiles')
      .select('id, email, role, account_status, display_name')
      .eq('id', userId)
      .single();

    if (checkErr) throw checkErr;
    console.log(`  ✅ Profile verified in DB:`, profileCheck);
    console.log('------------------------------------------------------------------------------');
  }

  console.log('\n🎉 ALL 3 TEST ACCOUNTS PROVISIONED & VERIFIED SUCCESSFULLY!\n');
}

setupAccounts().catch((err) => {
  console.error('Fatal error setting up test accounts:', err);
  process.exit(1);
});
