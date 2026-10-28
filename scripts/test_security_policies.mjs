import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load credentials safely from .env.local
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
  console.error('Missing credentials in .env.local');
  process.exit(1);
}

// Master Admin Client (Service Role - Used ONLY for test harness setup and cleanup)
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Anonymous Client (Simulates unauthenticated public visitor)
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// Helper to create an authenticated client using user session tokens
async function createAuthenticatedClient(email, password, role = 'customer') {
  // Check if test user exists in auth.users
  const { data: userList } = await adminClient.auth.admin.listUsers();
  let existingUser = userList?.users?.find((u) => u.email === email);

  if (!existingUser) {
    const { data: created, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: email.split('@')[0] },
    });
    if (error) throw new Error(`Failed to create test user ${email}: ${error.message}`);
    existingUser = created.user;
  }

  // Ensure role is assigned in profiles table
  await adminClient
    .from('profiles')
    .update({ role, account_status: 'active', display_name: email.split('@')[0] })
    .eq('id', existingUser.id);

  // Sign in with the anon client to get real scoped JWT tokens
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sessionData, error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw new Error(`Failed to sign in as ${email}: ${signInError.message}`);
  }

  return {
    client: userClient,
    user: existingUser,
    session: sessionData.session,
  };
}

let results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function assert(description, condition, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
    results.passed++;
    results.tests.push({ description, status: 'PASS' });
  } else {
    console.error(`  ❌ [FAIL] ${description} ${details ? `-> ${details}` : ''}`);
    results.failed++;
    results.tests.push({ description, status: 'FAIL', details });
  }
}

async function runTestSuite() {
  console.log('==============================================================================');
  console.log('   DATABASE SECURITY & RLS PERMISSION TEST SUITE');
  console.log('==============================================================================');

  const testPassword = 'TestSecurePassword123!';
  const timestamp = Date.now();

  const customerAEmail = `cust_a_${timestamp}@test.local`;
  const customerBEmail = `cust_b_${timestamp}@test.local`;
  const admin1Email = `admin_1_${timestamp}@test.local`;
  const admin2Email = `admin_2_${timestamp}@test.local`;
  const admin3Email = `admin_3_${timestamp}@test.local`;
  const superAdminEmail = `super_${timestamp}@test.local`;

  console.log('\n[1/5] Provisioning scoped test personas in Supabase Auth & Profiles...');
  const customerA = await createAuthenticatedClient(customerAEmail, testPassword, 'customer');
  const customerB = await createAuthenticatedClient(customerBEmail, testPassword, 'customer');
  const admin1 = await createAuthenticatedClient(admin1Email, testPassword, 'admin');
  const admin2 = await createAuthenticatedClient(admin2Email, testPassword, 'admin');
  const admin3 = await createAuthenticatedClient(admin3Email, testPassword, 'admin');
  const superAdmin = await createAuthenticatedClient(superAdminEmail, testPassword, 'super_admin');
  console.log('All 6 test personas successfully authenticated with isolated JWT tokens.');

  try {
    // --------------------------------------------------------------------------
    // SUITE 1: Public / Anonymous Access Controls
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 1: PUBLIC / ANONYMOUS ACCESS CONTROLS ---');

    // Setup published and draft posts via service client
    const { data: pubPost } = await adminClient
      .from('posts')
      .insert({
        author_id: admin1.user.id,
        title: 'Public Security Article',
        slug: `public-post-${timestamp}`,
        status: 'published',
        post_type: 'blog',
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    const { data: draftPost } = await adminClient
      .from('posts')
      .insert({
        author_id: admin1.user.id,
        title: 'Draft Private Article',
        slug: `draft-post-${timestamp}`,
        status: 'draft',
        post_type: 'blog',
      })
      .select()
      .single();

    // Test 1.1: Anon can read published posts
    const { data: anonPubPosts } = await anonClient
      .from('posts')
      .select('id, title')
      .eq('id', pubPost.id);
    assert('Public visitor can read published posts', anonPubPosts?.length === 1);

    // Test 1.2: Anon CANNOT read draft posts
    const { data: anonDraftPosts } = await anonClient
      .from('posts')
      .select('id, title')
      .eq('id', draftPost.id);
    assert('Public visitor CANNOT read draft posts (returns 0 rows)', anonDraftPosts?.length === 0);

    // Test 1.3: Anon CANNOT read profiles
    const { data: anonProfiles, error: anonProfError } = await anonClient.from('profiles').select('id, role');
    assert('Public visitor CANNOT select profiles table', !anonProfiles || anonProfiles.length === 0 || !!anonProfError);

    // Test 1.4: Anon CANNOT read contact inquiries
    const { data: anonInquiries, error: anonInqError } = await anonClient.from('contact_inquiries').select('*');
    assert('Public visitor CANNOT read or enumerate contact inquiries', !anonInquiries || anonInquiries.length === 0 || !!anonInqError);

    // Test 1.5: Anon CANNOT read audit logs
    const { data: anonAudit, error: anonAuditError } = await anonClient.from('audit_logs').select('*');
    assert('Public visitor CANNOT read audit logs', !anonAudit || anonAudit.length === 0 || !!anonAuditError);

    // --------------------------------------------------------------------------
    // SUITE 2: Customer Data Isolation & Live Chat Boundaries
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 2: CUSTOMER DATA ISOLATION ---');

    // Customer A creates conversation CA
    const { data: convA, error: convAError } = await customerA.client
      .from('conversations')
      .insert({
        customer_id: customerA.user.id,
        subject: "Customer A's Private Conversation",
        status: 'open',
      })
      .select()
      .single();
    assert('Customer A can create own conversation', !!convA && !convAError, convAError?.message);

    // Customer B creates conversation CB
    const { data: convB, error: convBError } = await customerB.client
      .from('conversations')
      .insert({
        customer_id: customerB.user.id,
        subject: "Customer B's Private Conversation",
        status: 'open',
      })
      .select()
      .single();
    assert('Customer B can create own conversation', !!convB && !convBError, convBError?.message);

    // Customer A attempts to read Customer B's conversation (Conversation ID Tampering)
    const { data: crossReadConv } = await customerA.client
      .from('conversations')
      .select('*')
      .eq('id', convB.id);
    assert("Customer A CANNOT read Customer B's conversation (ID tampering returns 0 rows)", crossReadConv?.length === 0);

    // Customer A posts message into own conversation CA
    const { data: msgA, error: msgAError } = await customerA.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: customerA.user.id,
        body: 'Hello, this is message in conversation A.',
      })
      .select()
      .single();
    assert('Customer A can post message into own conversation', !!msgA && !msgAError, msgAError?.message);

    // Customer A attempts to inject a message into Customer B's conversation CB
    const { data: injectMsg, error: injectError } = await customerA.client
      .from('messages')
      .insert({
        conversation_id: convB.id,
        sender_id: customerA.user.id,
        body: 'Malicious message injected by Customer A!',
      });
    assert('Customer A CANNOT insert messages into Customer B conversation (RLS violation)', !!injectError && !injectMsg);

    // Customer A attempts to read messages in Customer B's conversation CB
    const { data: crossReadMsgs } = await customerA.client
      .from('messages')
      .select('*')
      .eq('conversation_id', convB.id);
    assert("Customer A CANNOT read Customer B's messages (returns 0 rows)", crossReadMsgs?.length === 0);

    // Customer A attempts to select conversation_assignments (Staff list secrecy)
    const { data: custAssignments, error: assignError } = await customerA.client
      .from('conversation_assignments')
      .select('*');
    assert('Customer A CANNOT select conversation_assignments (staff identities protected)', !custAssignments || custAssignments.length === 0 || !!assignError);

    // --------------------------------------------------------------------------
    // SUITE 3: Multi-Admin Assignments & Scope Restrictions
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 3: MULTI-ADMIN ASSIGNMENTS & PARTICIPATION ---');

    // Super Admin assigns Admin 1 and Admin 2 to Conversation CA
    const { data: assign1, error: assign1Error } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: convA.id,
        admin_id: admin1.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      })
      .select()
      .single();
    assert('Super Admin can assign Admin 1 to conversation CA', !!assign1 && !assign1Error, assign1Error?.message);

    const { data: assign2, error: assign2Error } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: convA.id,
        admin_id: admin2.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      })
      .select()
      .single();
    assert('Super Admin can assign Admin 2 to conversation CA', !!assign2 && !assign2Error, assign2Error?.message);

    // Assigned Admin 1 reads Conversation CA
    const { data: admin1Read } = await admin1.client
      .from('conversations')
      .select('*')
      .eq('id', convA.id);
    assert('Assigned Admin 1 can read shared conversation CA', admin1Read?.length === 1);

    // Assigned Admin 2 reads Conversation CA
    const { data: admin2Read } = await admin2.client
      .from('conversations')
      .select('*')
      .eq('id', convA.id);
    assert('Assigned Admin 2 can read shared conversation CA', admin2Read?.length === 1);

    // Assigned Admin 1 posts message into Conversation CA
    const { data: adminMsg, error: adminMsgError } = await admin1.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin1.user.id,
        body: 'Admin 1 replying to Customer A in shared conversation.',
      })
      .select()
      .single();
    assert('Assigned Admin 1 can post staff message into shared conversation', !!adminMsg && !adminMsgError, adminMsgError?.message);

    // Unassigned Admin 3 attempts to read Conversation CA
    const { data: unassignedRead } = await admin3.client
      .from('conversations')
      .select('*')
      .eq('id', convA.id);
    assert('Unassigned Admin 3 CANNOT read unassigned conversation CA (returns 0 rows)', unassignedRead?.length === 0);

    // Unassigned Admin 3 attempts to post message to Conversation CA
    const { data: unassignedMsg, error: unassignedMsgError } = await admin3.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin3.user.id,
        body: 'Unassigned Admin 3 trying to post.',
      });
    assert('Unassigned Admin 3 CANNOT post messages to unassigned conversation (RLS violation)', !!unassignedMsgError && !unassignedMsg);

    // Revocation: Super Admin removes Admin 2 from Conversation CA (status = 'removed')
    const { error: removeError } = await superAdmin.client
      .from('conversation_assignments')
      .update({ status: 'removed', removed_at: new Date().toISOString() })
      .eq('id', assign2.id);
    assert('Super Admin can remove Admin 2 from conversation', !removeError);

    // Removed Admin 2 attempts to read Conversation CA
    const { data: removedAdminRead } = await admin2.client
      .from('conversations')
      .select('*')
      .eq('id', convA.id);
    assert('Removed Admin 2 access is IMMEDIATELY revoked (returns 0 rows)', removedAdminRead?.length === 0);

    // --------------------------------------------------------------------------
    // SUITE 4: Role Self-Escalation & Account Status Protection
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 4: ROLE SELF-ESCALATION PREVENTION ---');

    // Customer A attempts to promote self to super_admin
    const { data: custEscalate, error: custEscalateError } = await customerA.client
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', customerA.user.id)
      .select();

    // Verify role in database did NOT change
    const { data: verifiedProfileA } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', customerA.user.id)
      .single();

    assert(
      'Customer A CANNOT escalate role to super_admin (role remains customer)',
      verifiedProfileA?.role === 'customer' && (!custEscalate || custEscalate.length === 0 || !!custEscalateError)
    );

    // Admin 1 attempts to promote self to super_admin
    const { data: adminEscalate, error: adminEscalateError } = await admin1.client
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', admin1.user.id)
      .select();

    const { data: verifiedProfileAdmin1 } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', admin1.user.id)
      .single();

    assert(
      'Admin 1 CANNOT escalate role to super_admin (role remains admin)',
      verifiedProfileAdmin1?.role === 'admin' && (!adminEscalate || adminEscalate.length === 0 || !!adminEscalateError)
    );

    // --------------------------------------------------------------------------
    // SUITE 5: Super Admin Global Access & Audit Logs
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 5: SUPER ADMIN GLOBAL OVERSIGHT & AUDIT LOGS ---');

    // Super Admin can read all conversations without explicit assignment
    const { data: saAllConvs } = await superAdmin.client
      .from('conversations')
      .select('id, subject');
    const hasCA = saAllConvs?.some((c) => c.id === convA.id);
    const hasCB = saAllConvs?.some((c) => c.id === convB.id);
    assert('Super Admin can read all conversations (both CA and CB) globally', hasCA && hasCB);

    // Super Admin can insert message into any conversation
    const { data: saMsg, error: saMsgError } = await superAdmin.client
      .from('messages')
      .insert({
        conversation_id: convB.id,
        sender_id: superAdmin.user.id,
        body: 'Super Admin intervention message in conversation B.',
      })
      .select()
      .single();
    assert('Super Admin can participate directly in any conversation', !!saMsg && !saMsgError, saMsgError?.message);

    // Super Admin can read and write audit logs
    const { data: auditEntry, error: auditWriteError } = await superAdmin.client
      .from('audit_logs')
      .insert({
        actor_id: superAdmin.user.id,
        action: 'SECURITY_TEST_AUDIT_VERIFIED',
        target_type: 'system',
        target_id: 'test_runner',
        metadata: { timestamp },
      })
      .select()
      .single();
    assert('Super Admin can write audit log entry', !!auditEntry && !auditWriteError, auditWriteError?.message);

    const { data: saAuditRead } = await superAdmin.client
      .from('audit_logs')
      .select('*')
      .eq('id', auditEntry?.id);
    assert('Super Admin can read audit logs', saAuditRead?.length === 1);

    // Customer A attempts to read audit logs
    const { data: custAuditRead, error: custAuditError } = await customerA.client
      .from('audit_logs')
      .select('*');
    assert('Customer A CANNOT read audit logs (returns 0 rows)', !custAuditRead || custAuditRead.length === 0 || !!custAuditError);

  } finally {
    // --------------------------------------------------------------------------
    // CLEANUP: Clean up all test entities from live database
    // --------------------------------------------------------------------------
    console.log('\n--- CLEANUP: Removing temporary test personas and records ---');
    const testEmails = [customerAEmail, customerBEmail, admin1Email, admin2Email, admin3Email, superAdminEmail];
    
    // Clean up posts
    await adminClient.from('posts').delete().ilike('slug', `%-${timestamp}`);
    
    // Clean up users
    const { data: listData } = await adminClient.auth.admin.listUsers();
    for (const u of listData?.users || []) {
      if (testEmails.includes(u.email)) {
        await adminClient.auth.admin.deleteUser(u.id);
      }
    }
    console.log('Cleanup completed successfully.');
  }

  console.log('\n==============================================================================');
  console.log(`TEST RESULTS: ${results.passed} PASSED / ${results.failed} FAILED (${results.passed + results.failed} Total)`);
  console.log('==============================================================================');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
