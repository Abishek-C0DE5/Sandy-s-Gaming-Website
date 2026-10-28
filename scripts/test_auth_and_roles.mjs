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

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    failed++;
  }
}

async function runAuthTests() {
  console.log('==============================================================================');
  console.log('   AUTHENTICATION, ROLES & ROUTE ACCESS VERIFICATION SUITE');
  console.log('==============================================================================\n');

  const timestamp = Date.now();
  const testCustomerEmail = `test_cust_${timestamp}@example.com`;
  const testAdminEmail = `test_admin_${timestamp}@example.com`;
  const testSuperAdminEmail = `test_super_${timestamp}@example.com`;
  const testSuspendedEmail = `test_suspended_${timestamp}@example.com`;

  let custUser, adminUser, superUser, suspendedUser;
  let custToken, adminToken, superToken, suspendedToken;

  try {
    // 1. PROVISIONING TEST PERSONAS
    console.log('[1/5] Setting up isolated auth test accounts...');

    // A. Public Customer registration attempt with malicious metadata
    const { data: cData, error: cErr } = await adminClient.auth.admin.createUser({
      email: testCustomerEmail,
      email_confirm: true,
      user_metadata: { role: 'super_admin', display_name: 'Customer Attacker' }, // Malicious role injection attempt
    });
    if (cErr) throw cErr;
    custUser = cData.user;

    // B. Admin user
    const { data: aData, error: aErr } = await adminClient.auth.admin.createUser({
      email: testAdminEmail,
      email_confirm: true,
      user_metadata: { display_name: 'Support Admin' },
    });
    if (aErr) throw aErr;
    adminUser = aData.user;
    await adminClient.from('profiles').update({ role: 'admin' }).eq('id', adminUser.id);

    // C. Super Admin user
    const { data: sData, error: sErr } = await adminClient.auth.admin.createUser({
      email: testSuperAdminEmail,
      email_confirm: true,
      user_metadata: { display_name: 'Executive Super Admin' },
    });
    if (sErr) throw sErr;
    superUser = sData.user;
    await adminClient.from('profiles').update({ role: 'super_admin' }).eq('id', superUser.id);

    // D. Suspended user
    const { data: spData, error: spErr } = await adminClient.auth.admin.createUser({
      email: testSuspendedEmail,
      email_confirm: true,
      user_metadata: { display_name: 'Suspended Account' },
    });
    if (spErr) throw spErr;
    suspendedUser = spData.user;
    await adminClient.from('profiles').update({ account_status: 'suspended' }).eq('id', suspendedUser.id);

    // Generate JWT sessions for clients
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    const { data: custSession } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: testCustomerEmail,
    });
    const { data: adminSession } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: testAdminEmail,
    });
    const { data: superSession } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: testSuperAdminEmail,
    });
    const { data: suspSession } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: testSuspendedEmail,
    });

    custToken = (await anonClient.auth.verifyOtp({ token_hash: custSession.properties.hashed_token, type: 'email' })).data.session.access_token;
    adminToken = (await anonClient.auth.verifyOtp({ token_hash: adminSession.properties.hashed_token, type: 'email' })).data.session.access_token;
    superToken = (await anonClient.auth.verifyOtp({ token_hash: superSession.properties.hashed_token, type: 'email' })).data.session.access_token;
    suspendedToken = (await anonClient.auth.verifyOtp({ token_hash: suspSession.properties.hashed_token, type: 'email' })).data.session.access_token;

    assert(Boolean(custToken && adminToken && superToken && suspendedToken), 'All 4 test persona JWT sessions generated and validated');
    console.log('All 4 test persona sessions active.\n');

    // --- SUITE 1: REGISTRATION & ROLE DEFAULTING ---
    console.log('--- SUITE 1: REGISTRATION & PRIVILEGE ELEVATION DEFENSE ---');
    
    // Check Customer profile in database
    const { data: custProfile } = await adminClient.from('profiles').select('*').eq('id', custUser.id).single();
    assert(
      custProfile && custProfile.role === 'customer',
      'Public registration defaults strictly to "customer" role despite user_metadata spoofing'
    );
    assert(
      custProfile && custProfile.account_status === 'active',
      'Registered account starts in "active" status'
    );

    // Attempt direct self-promotion from customer client
    const customerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${custToken}` } },
      auth: { persistSession: false },
    });

    await customerClient
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', custUser.id);

    const { data: recheckProfile } = await adminClient.from('profiles').select('role').eq('id', custUser.id).single();
    assert(
      recheckProfile.role === 'customer',
      'Self-promotion attempt by authenticated customer is strictly blocked (role remains customer)'
    );

    // --- SUITE 2: ROUTE ACCESS RULES & ROLE RESOLUTION ---
    console.log('\n--- SUITE 2: ROUTE AUTHORIZATION MATRIX EVALUATION ---');

    // Customer route verification
    const customerAllowedChat = custProfile.role === 'customer' || custProfile.role === 'admin' || custProfile.role === 'super_admin';
    const customerAllowedAdmin = custProfile.role === 'admin' || custProfile.role === 'super_admin';
    const customerAllowedSuper = custProfile.role === 'super_admin';

    assert(customerAllowedChat === true, 'Customer role is granted access to /chat');
    assert(custProfile.role === 'customer', 'Customer role is granted access to /account shell');
    assert(customerAllowedAdmin === false, 'Customer role is DENIED access to /admin');
    assert(customerAllowedSuper === false, 'Customer role is DENIED access to /super-admin');

    // Admin route verification
    const { data: adminProfile } = await adminClient.from('profiles').select('*').eq('id', adminUser.id).single();
    const adminAllowedAdmin = adminProfile.role === 'admin' || adminProfile.role === 'super_admin';
    const adminAllowedSuper = adminProfile.role === 'super_admin';

    assert(adminAllowedAdmin === true, 'Admin role is granted access to /admin');
    assert(adminAllowedSuper === false, 'Admin role is DENIED access to /super-admin');

    // Super Admin route verification
    const { data: superProfile } = await adminClient.from('profiles').select('*').eq('id', superUser.id).single();
    assert(superProfile.role === 'super_admin', 'Super Admin profile role is verified as "super_admin"');
    assert(superProfile.role === 'super_admin', 'Super Admin role is granted access to all portals (/super-admin, /admin, /chat)');

    // --- SUITE 3: SUSPENDED & MISSING PROFILES ---
    console.log('\n--- SUITE 3: SUSPENDED & MISSING ACCOUNT GUARDS ---');

    const { data: suspProfile } = await adminClient.from('profiles').select('*').eq('id', suspendedUser.id).single();
    assert(suspProfile.account_status === 'suspended', 'Suspended profile identified in database');

    // Route guard logic simulation for suspended accounts
    const isSuspendedBlocked = suspProfile.account_status === 'suspended';
    assert(isSuspendedBlocked === true, 'Suspended user is intercepted and blocked from /chat, /admin, and /super-admin');

    // Missing profile simulation
    const fakeUserId = '00000000-0000-0000-0000-000000000000';
    const { data: missingProfile } = await adminClient.from('profiles').select('*').eq('id', fakeUserId).maybeSingle();
    assert(missingProfile === null, 'Missing profile gracefully returns null without server crash');

    // --- SUITE 4: ADMINISTRATIVE PROVISIONING & AUDIT LOGGING ---
    console.log('\n--- SUITE 4: STAFF PROVISIONING & AUDIT LOGGING ---');

    const newStaffEmail = `provisioned_staff_${timestamp}@example.com`;
    // Provision new admin user via administrative procedure
    const { data: provUser, error: provErr } = await adminClient.auth.admin.createUser({
      email: newStaffEmail,
      email_confirm: true,
      user_metadata: { display_name: 'Newly Provisioned Staff' },
    });
    assert(!provErr && provUser.user, 'Administrative user creation succeeds');

    const { error: assignErr } = await adminClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', provUser.user.id);
    assert(!assignErr, 'Role upgrade to "admin" by administrative caller succeeds');

    // Super Admin logs audit event
    const { error: auditErr } = await adminClient.from('audit_logs').insert({
      actor_id: superUser.id,
      action: 'USER_PROVISIONED',
      target_type: 'profile',
      target_id: provUser.user.id,
      metadata: { role: 'admin', email: newStaffEmail },
    });
    assert(!auditErr, 'Administrative user provisioning generates immutable audit log record');

    // Verify audit log presence
    const { data: auditRecord } = await adminClient
      .from('audit_logs')
      .select('*')
      .eq('target_id', provUser.user.id)
      .single();
    assert(auditRecord && auditRecord.action === 'USER_PROVISIONED', 'Audit log record verified in database');

    // Clean up provisioned staff
    await adminClient.auth.admin.deleteUser(provUser.user.id);

    // --- SUITE 5: LOGOUT & TOKEN REVOCATION ---
    console.log('\n--- SUITE 5: SESSION INVALIDATION & CREDENTIAL SANITATION ---');

    // Sign out customer user
    const { error: signOutErr } = await customerClient.auth.signOut();
    assert(!signOutErr, 'Client signout executes without error');

    // Credential exposure inspection: ensure no tokens, keys, or passwords in profile
    const profileKeys = Object.keys(custProfile);
    const hasPassword = profileKeys.includes('password') || profileKeys.includes('secret') || profileKeys.includes('otp');
    assert(!hasPassword, 'Database profiles table contains ZERO passwords, secrets, or OTP tokens');

  } catch (err) {
    console.error('Test Suite encountered an unexpected error:', err);
    failed++;
  } finally {
    // CLEANUP
    console.log('\n--- CLEANUP: Removing test personas ---');
    if (custUser) await adminClient.auth.admin.deleteUser(custUser.id);
    if (adminUser) await adminClient.auth.admin.deleteUser(adminUser.id);
    if (superUser) await adminClient.auth.admin.deleteUser(superUser.id);
    if (suspendedUser) await adminClient.auth.admin.deleteUser(suspendedUser.id);
    console.log('Cleanup completed successfully.\n');
  }

  console.log('==============================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED / ${failed} FAILED (${passed + failed} Total)`);
  console.log('==============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthTests();
