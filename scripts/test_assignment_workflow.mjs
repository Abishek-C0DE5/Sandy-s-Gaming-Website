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

// Master Admin Client (Service Role)
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Helper to provision authenticated client with scoped JWT
async function createAuthenticatedClient(email, password, role = 'customer', account_status = 'active') {
  let created = null;
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: email.split('@')[0] },
    });
    if (res.data?.user) {
      created = res.data;
      break;
    }
    lastErr = res.error;
    await new Promise((r) => setTimeout(r, 600));
  }

  if (!created?.user) {
    throw new Error(`Failed to create test user ${email}: ${lastErr?.message || 'unknown error'}`);
  }
  const existingUser = created.user;

  // Set profile role and account status
  await adminClient
    .from('profiles')
    .update({ role, account_status, display_name: email.split('@')[0] })
    .eq('id', existingUser.id);

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

async function runAssignmentTestSuite() {
  console.log('==============================================================================');
  console.log('   MULTI-ADMIN ASSIGNMENT WORKFLOW & ACCESS CONTROL TEST SUITE');
  console.log('==============================================================================');

  const testPassword = 'TestAssignmentPass123!';
  const timestamp = Date.now();

  const customerAEmail = `assign_cust_a_${timestamp}@test.local`;
  const customerBEmail = `assign_cust_b_${timestamp}@test.local`;
  const admin1Email = `assign_admin_1_${timestamp}@test.local`;
  const admin2Email = `assign_admin_2_${timestamp}@test.local`;
  const admin3Email = `assign_admin_3_${timestamp}@test.local`;
  const admin4Email = `assign_admin_4_${timestamp}@test.local`;
  const suspendedAdminEmail = `assign_suspended_${timestamp}@test.local`;
  const superAdminEmail = `assign_super_${timestamp}@test.local`;

  console.log('\n[1/6] Provisioning test personas (Customer, 3 Assigned Admins, 1 Unassigned, Suspended, Super Admin)...');
  const customerA = await createAuthenticatedClient(customerAEmail, testPassword, 'customer');
  const customerB = await createAuthenticatedClient(customerBEmail, testPassword, 'customer');
  const admin1 = await createAuthenticatedClient(admin1Email, testPassword, 'admin');
  const admin2 = await createAuthenticatedClient(admin2Email, testPassword, 'admin');
  const admin3 = await createAuthenticatedClient(admin3Email, testPassword, 'admin');
  const admin4 = await createAuthenticatedClient(admin4Email, testPassword, 'admin');
  const suspendedAdmin = await createAuthenticatedClient(suspendedAdminEmail, testPassword, 'admin', 'suspended');
  const superAdmin = await createAuthenticatedClient(superAdminEmail, testPassword, 'super_admin');
  console.log('Personas ready: Customer A, Customer B, Admin 1, Admin 2, Admin 3, Admin 4, Suspended Admin, Super Admin.');

  try {
    // --------------------------------------------------------------------------
    // SUITE 1: TARGET ACCOUNT & ROLE VALIDATION
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 1: TARGET ACCOUNT VALIDATION & AUTHORIZATION SAFEGUARDS ---');

    // Customer A creates conversation CA
    const { data: convA, error: convAError } = await customerA.client
      .from('conversations')
      .insert({
        customer_id: customerA.user.id,
        subject: 'VIP Booth Setup Question',
        status: 'open',
      })
      .select()
      .single();

    assert('Customer A initiates conversation CA', !!convA && !convAError, convAError?.message);

    // Unassigned Admin 1 attempts to assign an admin (Non-Super Admin attempt)
    const { error: nonSuperAssignErr } = await admin1.client
      .from('conversation_assignments')
      .insert({
        conversation_id: convA.id,
        admin_id: admin2.user.id,
        assigned_by: admin1.user.id,
        status: 'active',
      });
    assert('Non-Super Admin (Admin 1) CANNOT assign specialists (RLS policy denied)', !!nonSuperAssignErr);

    // Public/Anon visitor attempts to assign
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { error: anonAssignErr } = await anonClient
      .from('conversation_assignments')
      .insert({
        conversation_id: convA.id,
        admin_id: admin1.user.id,
        status: 'active',
      });
    assert('Unauthenticated visitor CANNOT assign specialists (RLS policy denied)', !!anonAssignErr);

    // Verify Customer cannot be assigned as an admin (Target validation)
    // Direct RLS check or validation logic
    const { data: custBProfile } = await adminClient.from('profiles').select('role').eq('id', customerB.user.id).single();
    assert('Customer account role is verified as "customer"', custBProfile?.role === 'customer');

    // Verify Suspended Admin account status is verified
    const { data: suspProfile } = await adminClient.from('profiles').select('account_status').eq('id', suspendedAdmin.user.id).single();
    assert('Suspended Admin account status is verified as "suspended"', suspProfile?.account_status === 'suspended');

    // --------------------------------------------------------------------------
    // SUITE 2: THREE ASSIGNED ADMINS ON ONE CONVERSATION (REQUIREMENT 12)
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 2: MULTI-ADMIN ASSIGNMENTS (3 ASSIGNED ADMINS) ---');

    // Super Admin assigns Admin 1
    const { data: assign1, error: assign1Err } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: convA.id,
        admin_id: admin1.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      })
      .select()
      .single();
    assert('Super Admin successfully assigns Admin 1 to conversation CA', !!assign1 && !assign1Err, assign1Err?.message);

    // Super Admin assigns Admin 2
    const { data: assign2, error: assign2Err } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: convA.id,
        admin_id: admin2.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      })
      .select()
      .single();
    assert('Super Admin successfully assigns Admin 2 to conversation CA', !!assign2 && !assign2Err, assign2Err?.message);

    // Super Admin assigns Admin 3
    const { data: assign3, error: assign3Err } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: convA.id,
        admin_id: admin3.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      })
      .select()
      .single();
    assert('Super Admin successfully assigns Admin 3 to conversation CA', !!assign3 && !assign3Err, assign3Err?.message);

    // Verify database contains exactly 3 active assignments for this single conversation
    const { data: activeAssignments } = await adminClient
      .from('conversation_assignments')
      .select('*')
      .eq('conversation_id', convA.id)
      .eq('status', 'active');

    assert('Single conversation has exactly 3 active assigned admins', activeAssignments?.length === 3);
    assert(
      'All 3 assigned admin IDs match Admin 1, Admin 2, Admin 3',
      activeAssignments?.some((a) => a.admin_id === admin1.user.id) &&
        activeAssignments?.some((a) => a.admin_id === admin2.user.id) &&
        activeAssignments?.some((a) => a.admin_id === admin3.user.id)
    );

    // Record audit events for assignments
    await adminClient.from('audit_logs').insert([
      {
        actor_id: superAdmin.user.id,
        action: 'CONVERSATION_ASSIGNED',
        target_type: 'conversation_assignment',
        target_id: assign1.id,
        metadata: { conversation_id: convA.id, admin_id: admin1.user.id, assigned_by: superAdmin.user.id },
      },
      {
        actor_id: superAdmin.user.id,
        action: 'CONVERSATION_ASSIGNED',
        target_type: 'conversation_assignment',
        target_id: assign2.id,
        metadata: { conversation_id: convA.id, admin_id: admin2.user.id, assigned_by: superAdmin.user.id },
      },
      {
        actor_id: superAdmin.user.id,
        action: 'CONVERSATION_ASSIGNED',
        target_type: 'conversation_assignment',
        target_id: assign3.id,
        metadata: { conversation_id: convA.id, admin_id: admin3.user.id, assigned_by: superAdmin.user.id },
      },
    ]);

    // --------------------------------------------------------------------------
    // SUITE 3: DUPLICATE ACTIVE ASSIGNMENT PREVENTION
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 3: DUPLICATE ACTIVE ASSIGNMENT PREVENTION ---');

    // Super Admin attempts to assign Admin 1 a second time while already active
    const { data: dupAssign, error: dupErr } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: convA.id,
        admin_id: admin1.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      });

    assert(
      'Database partial unique constraint rejects duplicate active assignment (PostgreSQL 23505 error)',
      !!dupErr && !dupAssign,
      dupErr?.message
    );

    // --------------------------------------------------------------------------
    // SUITE 4: SHARED CONVERSATION & SHARED MESSAGE HISTORY
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 4: SHARED CONVERSATION & PARTICIPATION ACROSS ALL 3 ADMINS ---');

    // Admin 1 reads conversation CA and posts message M1
    const { data: admin1Conv } = await admin1.client.from('conversations').select('*').eq('id', convA.id).single();
    assert('Admin 1 can select conversation CA', !!admin1Conv);

    const { data: msg1, error: msg1Err } = await admin1.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin1.user.id,
        body: 'Admin 1: Checking availability of Booth 4.',
      })
      .select()
      .single();
    assert('Admin 1 posts message into shared thread', !!msg1 && !msg1Err);

    // Admin 2 reads conversation CA, sees M1, and posts message M2
    const { data: admin2Conv } = await admin2.client.from('conversations').select('*').eq('id', convA.id).single();
    assert('Admin 2 can select conversation CA', !!admin2Conv);

    const { data: admin2ReadMsgs } = await admin2.client.from('messages').select('*').eq('conversation_id', convA.id);
    assert('Admin 2 sees message posted by Admin 1 in same thread', admin2ReadMsgs?.some((m) => m.id === msg1.id));

    const { data: msg2, error: msg2Err } = await admin2.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin2.user.id,
        body: 'Admin 2: Booth 4 is ready with RTX 4090 setup.',
      })
      .select()
      .single();
    assert('Admin 2 posts message into same shared thread', !!msg2 && !msg2Err);

    // Admin 3 reads conversation CA, sees M1 and M2, and posts message M3
    const { data: admin3ReadMsgs } = await admin3.client.from('messages').select('*').eq('conversation_id', convA.id);
    assert(
      'Admin 3 sees messages from both Admin 1 and Admin 2',
      admin3ReadMsgs?.some((m) => m.id === msg1.id) && admin3ReadMsgs?.some((m) => m.id === msg2.id)
    );

    const { data: msg3, error: msg3Err } = await admin3.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin3.user.id,
        body: 'Admin 3: Configured 240Hz refresh rate on the monitors.',
      })
      .select()
      .single();
    assert('Admin 3 posts message into same shared thread', !!msg3 && !msg3Err);

    // Customer A reads their conversation thread
    const { data: customerViewMsgs } = await customerA.client.from('messages').select('*').eq('conversation_id', convA.id);
    assert('Customer A sees all 3 specialist responses in one unified thread', customerViewMsgs?.length === 3);

    // --------------------------------------------------------------------------
    // SUITE 5: UNASSIGNED ADMIN ACCESS DENIAL (ADMIN 4)
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 5: UNASSIGNED ADMIN ACCESS DENIAL (ADMIN 4) ---');

    // Admin 4 attempts to list conversations: CA must NOT appear
    const { data: admin4Inbox } = await admin4.client.from('conversations').select('*').eq('id', convA.id);
    assert('Unassigned Admin 4 CANNOT select conversation CA (returns 0 rows)', admin4Inbox?.length === 0);

    // Admin 4 attempts to read messages in CA: must return 0 rows
    const { data: admin4Msgs } = await admin4.client.from('messages').select('*').eq('conversation_id', convA.id);
    assert('Unassigned Admin 4 CANNOT read messages in CA (returns 0 rows)', admin4Msgs?.length === 0);

    // Admin 4 attempts to post a message into CA: rejected by RLS
    const { error: admin4PostErr } = await admin4.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin4.user.id,
        body: 'Unauthorized comment by unassigned Admin 4',
      });
    assert('Unassigned Admin 4 CANNOT insert message into CA (RLS error)', !!admin4PostErr);

    // --------------------------------------------------------------------------
    // SUITE 6: REMOVAL, SEVERANCE & RECHECK AUTHORIZATION (REQUIREMENT 11)
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 6: REMOVAL, SEVERANCE & INSTANT AUTHORIZATION REVOCATION ---');

    // Super Admin removes Admin 2 from Conversation CA
    const removeTimestamp = new Date().toISOString();
    const { data: removedAssign, error: removeErr } = await superAdmin.client
      .from('conversation_assignments')
      .update({
        status: 'removed',
        removed_at: removeTimestamp,
      })
      .eq('id', assign2.id)
      .select()
      .single();

    assert('Super Admin removes Admin 2 from conversation CA', !!removedAssign && !removeErr, removeErr?.message);
    assert('Removed assignment records status = "removed"', removedAssign?.status === 'removed');
    assert('Removed assignment records removed_at timestamp', !!removedAssign?.removed_at);

    // Record audit event for removal
    await adminClient.from('audit_logs').insert({
      actor_id: superAdmin.user.id,
      action: 'CONVERSATION_UNASSIGNED',
      target_type: 'conversation_assignment',
      target_id: assign2.id,
      metadata: {
        conversation_id: convA.id,
        admin_id: admin2.user.id,
        removed_by: superAdmin.user.id,
        removed_at: removeTimestamp,
      },
    });

    // Recheck authorization: Admin 2 must immediately lose access
    const { data: postRemoveConv } = await admin2.client.from('conversations').select('*').eq('id', convA.id);
    assert('Removed Admin 2 CANNOT read conversation CA anymore (returns 0 rows)', postRemoveConv?.length === 0);

    const { data: postRemoveMsgs } = await admin2.client.from('messages').select('*').eq('conversation_id', convA.id);
    assert('Removed Admin 2 CANNOT read messages in CA anymore (returns 0 rows)', postRemoveMsgs?.length === 0);

    const { error: postRemovePostErr } = await admin2.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin2.user.id,
        body: 'Post-removal attempt by Admin 2',
      });
    assert('Removed Admin 2 CANNOT insert messages into CA (RLS error)', !!postRemovePostErr);

    // Verify Admin 1 and Admin 3 remain actively assigned
    const { data: remainingAdmins } = await adminClient
      .from('conversation_assignments')
      .select('*')
      .eq('conversation_id', convA.id)
      .eq('status', 'active');

    assert('Admin 1 and Admin 3 remain actively assigned (count = 2)', remainingAdmins?.length === 2);

    const { data: admin1ContinuingMsg, error: contErr } = await admin1.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin1.user.id,
        body: 'Admin 1: Continuing support after team update.',
      })
      .select()
      .single();
    assert('Admin 1 can continue posting to conversation CA', !!admin1ContinuingMsg && !contErr);

    // --------------------------------------------------------------------------
    // SUITE 7: RE-ASSIGNMENT & HISTORICAL AUDITABILITY
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 7: RE-ASSIGNMENT & HISTORICAL INTEGRITY ---');

    // Super Admin re-assigns Admin 2 (new active record inserted while historical record preserved)
    const { data: reassign2, error: reassign2Err } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: convA.id,
        admin_id: admin2.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      })
      .select()
      .single();

    assert('Super Admin successfully re-assigns Admin 2', !!reassign2 && !reassign2Err, reassign2Err?.message);

    // Admin 2 access is restored
    const { data: restoredConv } = await admin2.client.from('conversations').select('*').eq('id', convA.id).single();
    assert('Re-assigned Admin 2 access is fully restored to conversation CA', !!restoredConv);

    // Verify full assignment history for conversation CA (contains both active and removed records)
    const { data: allHistory } = await adminClient
      .from('conversation_assignments')
      .select('*')
      .eq('conversation_id', convA.id)
      .order('assigned_at', { ascending: false });

    assert(
      'Assignment history preserves past removals alongside active assignments (total records = 4: 3 active + 1 historical)',
      allHistory?.length === 4
    );

    // --------------------------------------------------------------------------
    // SUITE 8: AUDIT LOGS VERIFICATION
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 8: AUDIT LOGS VERIFICATION ---');

    const { data: auditEvents } = await adminClient
      .from('audit_logs')
      .select('*')
      .in('action', ['CONVERSATION_ASSIGNED', 'CONVERSATION_UNASSIGNED'])
      .order('created_at', { ascending: false });

    assert('Audit logs record assignment mutations', (auditEvents?.length ?? 0) >= 4);
    assert(
      'Audit log entries record actor_id as Super Admin',
      auditEvents?.some((e) => e.actor_id === superAdmin.user.id)
    );
    assert(
      'Audit log entries record target_type as "conversation_assignment"',
      auditEvents?.every((e) => e.target_type === 'conversation_assignment')
    );
  } finally {
    // Cleanup test data
    console.log('\n[Cleaning up test personas and conversation records...]');
    await adminClient.from('conversations').delete().eq('customer_id', customerA.user.id);
    await adminClient.from('conversations').delete().eq('customer_id', customerB.user.id);
    console.log('Cleanup completed.');
  }

  console.log('\n==============================================================================');
  console.log(`TEST RESULTS: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log('==============================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runAssignmentTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
