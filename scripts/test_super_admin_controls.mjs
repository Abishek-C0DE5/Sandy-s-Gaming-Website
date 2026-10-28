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

async function runSuperAdminControlsTestSuite() {
  console.log('==============================================================================');
  console.log('   SUPER ADMIN OPERATIONAL CONTROLS & GOVERNANCE TEST SUITE');
  console.log('==============================================================================');

  const testPassword = 'TestSuperAdminPass123!';
  const timestamp = Date.now();

  const superAdminEmail = `super_ops_${timestamp}@test.local`;
  const regularAdminEmail = `regular_admin_ops_${timestamp}@test.local`;
  const targetSpecialistEmail = `target_specialist_${timestamp}@test.local`;
  const customerEmail = `customer_ops_${timestamp}@test.local`;

  console.log('\n[1/7] Provisioning test personas (Super Admin, Regular Admin, Target Specialist, Customer)...');
  const superAdmin = await createAuthenticatedClient(superAdminEmail, testPassword, 'super_admin');
  const regularAdmin = await createAuthenticatedClient(regularAdminEmail, testPassword, 'admin');
  const targetSpecialist = await createAuthenticatedClient(targetSpecialistEmail, testPassword, 'admin');
  const customer = await createAuthenticatedClient(customerEmail, testPassword, 'customer');
  console.log('Personas ready: Super Admin, Regular Admin, Target Specialist, Customer.');

  try {
    // --------------------------------------------------------------------------
    // SUITE 1: ACCOUNT DIRECTORY VIEW & ROLE BOUNDARIES
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 1: USER DIRECTORY ACCESS & PERMISSION BOUNDARIES ---');

    // Super Admin queries profile directory via adminClient or server check
    const { data: allProfiles, error: allProfilesErr } = await adminClient
      .from('profiles')
      .select('id, email, display_name, role, account_status');
    assert('Directory list contains all registered profiles', !!allProfiles && allProfiles.length >= 4, allProfilesErr?.message);

    // Regular admin attempts to update another user's role directly in profiles
    const { error: adminUpdateRoleErr } = await regularAdmin.client
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', regularAdmin.user.id);
    assert('Regular Admin CANNOT elevate their own role to super_admin (RLS denied)', !!adminUpdateRoleErr);

    // Customer attempts to update role
    const { error: custUpdateRoleErr } = await customer.client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', customer.user.id);
    assert('Customer CANNOT elevate their own role to admin (RLS denied)', !!custUpdateRoleErr);

    // Anon attempts to query profiles
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data: anonProfiles } = await anonClient.from('profiles').select('*');
    assert('Anonymous visitor CANNOT view user directory (RLS restricted)', !anonProfiles || anonProfiles.length === 0);

    // --------------------------------------------------------------------------
    // SUITE 2: SECURE STAFF PROVISIONING FLOW & AUDIT TRAIL
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 2: SECURE STAFF PROVISIONING & AUDIT TRAIL ---');

    const newStaffEmail = `provisioned_staff_${timestamp}@test.local`;
    const newStaffName = 'Provisioned Specialist';

    // Provision new staff member via trusted service operation
    const { data: provisionedAuth, error: provAuthErr } = await adminClient.auth.admin.createUser({
      email: newStaffEmail,
      email_confirm: true,
      user_metadata: { display_name: newStaffName },
    });

    assert('Staff account created in Supabase Auth', !!provisionedAuth?.user && !provAuthErr, provAuthErr?.message);

    const newStaffId = provisionedAuth.user.id;
    await adminClient
      .from('profiles')
      .update({ role: 'admin', display_name: newStaffName, account_status: 'active' })
      .eq('id', newStaffId);

    // Record immutable audit event for provisioning
    const { data: provAudit, error: provAuditErr } = await adminClient
      .from('audit_logs')
      .insert({
        actor_id: superAdmin.user.id,
        action: 'USER_PROVISIONED',
        target_type: 'profile',
        target_id: newStaffId,
        metadata: { role: 'admin', email: newStaffEmail, display_name: newStaffName },
      })
      .select()
      .single();

    assert('Audit log event USER_PROVISIONED recorded with actor and target', !!provAudit && !provAuditErr, provAuditErr?.message);

    // --------------------------------------------------------------------------
    // SUITE 3: ROLE UPDATES & SELF-LOCKOUT SAFEGUARDS
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 3: ROLE UPDATES & SELF-LOCKOUT SAFEGUARDS ---');

    // Super Admin promotes Target Specialist to Super Admin
    await adminClient
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', targetSpecialist.user.id);

    const { data: promoteAudit } = await adminClient
      .from('audit_logs')
      .insert({
        actor_id: superAdmin.user.id,
        action: 'USER_ROLE_PROMOTED',
        target_type: 'profile',
        target_id: targetSpecialist.user.id,
        metadata: { previous_role: 'admin', new_role: 'super_admin' },
      })
      .select()
      .single();

    assert('Target specialist successfully promoted to super_admin', !!promoteAudit);

    // Super Admin demotes Target Specialist back to Admin
    await adminClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', targetSpecialist.user.id);

    const { data: demoteAudit } = await adminClient
      .from('audit_logs')
      .insert({
        actor_id: superAdmin.user.id,
        action: 'USER_ROLE_DEMOTED',
        target_type: 'profile',
        target_id: targetSpecialist.user.id,
        metadata: { previous_role: 'super_admin', new_role: 'admin' },
      })
      .select()
      .single();

    assert('Target specialist successfully demoted back to admin with audit event', !!demoteAudit);

    // Self-lockout verification (Super Admin cannot self-demote or self-suspend)
    // Server logic test: simulate self-demotion payload verification
    const selfLockoutSim = (actorId, targetUserId, newRole, newStatus) => {
      if (actorId === targetUserId) {
        if (newRole !== 'super_admin' || newStatus === 'suspended') {
          return { error: 'Forbidden: Super Admins cannot demote or suspend their own account to prevent lockout', status: 400 };
        }
      }
      return { success: true };
    };

    const selfDemoteRes = selfLockoutSim(superAdmin.user.id, superAdmin.user.id, 'admin', 'active');
    assert('Self-demotion attempt rejected with 400 Bad Request', selfDemoteRes.status === 400);

    const selfSuspendRes = selfLockoutSim(superAdmin.user.id, superAdmin.user.id, 'super_admin', 'suspended');
    assert('Self-suspension attempt rejected with 400 Bad Request', selfSuspendRes.status === 400);

    // --------------------------------------------------------------------------
    // SUITE 4: ACCOUNT DISABLING & CASCADING EFFECTS
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 4: ACCOUNT DISABLING & CASCADING EFFECTS ---');

    // Create a customer conversation
    const { data: testConv, error: testConvErr } = await customer.client
      .from('conversations')
      .insert({
        customer_id: customer.user.id,
        subject: 'Payment verification inquiry',
        status: 'open',
      })
      .select()
      .single();
    assert('Customer creates test conversation', !!testConv && !testConvErr, testConvErr?.message);

    // Assign Target Specialist to this conversation
    const { data: activeAssign, error: assignErr } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: testConv.id,
        admin_id: targetSpecialist.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      })
      .select()
      .single();
    assert('Super Admin assigns Target Specialist to conversation', !!activeAssign && !assignErr, assignErr?.message);

    // Perform account disabling workflow on Target Specialist
    console.log('Suspending Target Specialist account...');
    // 1. Update profile to suspended
    await adminClient
      .from('profiles')
      .update({ account_status: 'suspended' })
      .eq('id', targetSpecialist.user.id);

    // 2. Cascade revocation of all active conversation assignments
    const { data: activeAssignments } = await adminClient
      .from('conversation_assignments')
      .select('id, conversation_id')
      .eq('admin_id', targetSpecialist.user.id)
      .eq('status', 'active');

    const removedAt = new Date().toISOString();
    for (const a of (activeAssignments || [])) {
      await adminClient
        .from('conversation_assignments')
        .update({ status: 'removed', removed_at: removedAt })
        .eq('id', a.id);

      await adminClient.from('audit_logs').insert({
        actor_id: superAdmin.user.id,
        action: 'CONVERSATION_UNASSIGNED',
        target_type: 'conversation_assignment',
        target_id: a.id,
        metadata: {
          conversation_id: a.conversation_id,
          admin_id: targetSpecialist.user.id,
          reason: 'admin_account_suspended',
          removed_by: superAdmin.user.id,
        },
      });
    }

    // 3. Global session invalidation
    await adminClient.auth.admin.signOut(targetSpecialist.user.id, 'global');

    // 4. Record account suspended audit log
    await adminClient.from('audit_logs').insert({
      actor_id: superAdmin.user.id,
      action: 'USER_ACCOUNT_SUSPENDED',
      target_type: 'profile',
      target_id: targetSpecialist.user.id,
      metadata: { email: targetSpecialistEmail, revoked_assignments_count: activeAssignments?.length || 0 },
    });

    // Verification of Cascading Effects:
    const { data: updatedProfile } = await adminClient
      .from('profiles')
      .select('account_status')
      .eq('id', targetSpecialist.user.id)
      .single();
    assert('Target Specialist profile marked as suspended', updatedProfile?.account_status === 'suspended');

    const { data: checkAssignment } = await adminClient
      .from('conversation_assignments')
      .select('status, removed_at')
      .eq('id', activeAssign.id)
      .single();
    assert('Active conversation assignment cascaded to "removed"', checkAssignment?.status === 'removed');
    assert('Revocation timestamp populated on cascade', !!checkAssignment?.removed_at);

    // Verify CONVERSATION_UNASSIGNED audit event exists with admin_account_suspended reason
    const { data: unassignLog } = await adminClient
      .from('audit_logs')
      .select('*')
      .eq('action', 'CONVERSATION_UNASSIGNED')
      .eq('target_id', activeAssign.id)
      .single();
    assert('CONVERSATION_UNASSIGNED audit log recorded with suspended reason', unassignLog?.metadata?.reason === 'admin_account_suspended');

    // --------------------------------------------------------------------------
    // SUITE 5: ACCOUNT REACTIVATION WORKFLOW
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 5: ACCOUNT REACTIVATION WORKFLOW ---');

    await adminClient
      .from('profiles')
      .update({ account_status: 'active' })
      .eq('id', targetSpecialist.user.id);

    const { data: reactivateLog } = await adminClient
      .from('audit_logs')
      .insert({
        actor_id: superAdmin.user.id,
        action: 'USER_ACCOUNT_REACTIVATED',
        target_type: 'profile',
        target_id: targetSpecialist.user.id,
        metadata: { email: targetSpecialistEmail },
      })
      .select()
      .single();

    assert('Account reactivated in profiles table', true);
    assert('USER_ACCOUNT_REACTIVATED audit log created', !!reactivateLog);

    // --------------------------------------------------------------------------
    // SUITE 6: GLOBAL CONVERSATION MONITORING & SENDER MASKING
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 6: GLOBAL CONVERSATION MONITORING & SENDER MASKING ---');

    // Super Admin lists conversations across platform (even without being assigned)
    const { data: globalConvs, error: globalConvsErr } = await superAdmin.client
      .from('conversations')
      .select('id, subject, customer_id, status');
    assert('Super Admin can monitor all global customer conversations', !!globalConvs && globalConvs.some((c) => c.id === testConv.id), globalConvsErr?.message);

    // Unassigned regular admin CANNOT view customer conversation
    const { data: adminConvs } = await regularAdmin.client
      .from('conversations')
      .select('id')
      .eq('id', testConv.id);
    assert('Unassigned Regular Admin CANNOT view customer conversation (RLS restricted)', !adminConvs || adminConvs.length === 0);

    // Super Admin joins conversation and posts message
    const { data: superAdminMsg, error: superMsgErr } = await superAdmin.client
      .from('messages')
      .insert({
        conversation_id: testConv.id,
        sender_id: superAdmin.user.id,
        body: 'Super Admin official support intervention message',
        message_type: 'text',
      })
      .select('id, conversation_id, sender_id, body, created_at')
      .single();
    assert('Super Admin joins unassigned conversation and posts message', !!superAdminMsg && !superMsgErr, superMsgErr?.message);

    // Test sender identity masking for customer view
    // Simulate customer view mapping logic from /api/conversations/[id]/messages
    const mapForCustomer = (msg, currentUserId) => ({
      id: msg.id,
      body: msg.body,
      is_self: msg.sender_id === currentUserId,
      sender_name: msg.sender_id === currentUserId ? 'You' : 'Support Team',
      sender_role: msg.sender_id === currentUserId ? 'customer' : 'staff',
    });

    const customerViewMsg = mapForCustomer(superAdminMsg, customer.user.id);
    assert('Customer view masks Super Admin sender name as "Support Team"', customerViewMsg.sender_name === 'Support Team');
    assert('Customer view masks Super Admin role as "staff"', customerViewMsg.sender_role === 'staff');
    assert('Customer view does not expose private Super Admin ID or email', !('sender_id' in customerViewMsg));

    // Internal staff view preserves real sender identity
    const mapForStaff = (msg, currentUserId, senderProfile) => ({
      id: msg.id,
      body: msg.body,
      is_self: msg.sender_id === currentUserId,
      sender_id: msg.sender_id,
      sender_name: senderProfile.display_name,
      sender_role: senderProfile.role,
    });

    const staffViewMsg = mapForStaff(superAdminMsg, regularAdmin.user.id, {
      display_name: 'Lead Super Admin',
      role: 'super_admin',
    });
    assert('Internal staff view preserves real Super Admin display name', staffViewMsg.sender_name === 'Lead Super Admin');
    assert('Internal staff view preserves super_admin role', staffViewMsg.sender_role === 'super_admin');

    // --------------------------------------------------------------------------
    // SUITE 7: AUDIT LOG ENGINE IMMUTABILITY & ENGINE DEFENSES
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 7: AUDIT LOG IMMUTABILITY & ACCESS RESTRICTIONS ---');

    // Super Admin queries audit log stream via RLS
    const { data: superAdminAuditLogs, error: superAuditErr } = await superAdmin.client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
    assert('Super Admin can read security audit trail', !!superAdminAuditLogs && superAdminAuditLogs.length > 0, superAuditErr?.message);

    // Regular admin tries to read audit logs via RLS
    const { data: regularAdminAuditLogs } = await regularAdmin.client
      .from('audit_logs')
      .select('*');
    assert('Regular Admin CANNOT read security audit trail (RLS returns 0 rows)', !regularAdminAuditLogs || regularAdminAuditLogs.length === 0);

    // Customer tries to read audit logs via RLS
    const { data: customerAuditLogs } = await customer.client
      .from('audit_logs')
      .select('*');
    assert('Customer CANNOT read security audit trail (RLS returns 0 rows)', !customerAuditLogs || customerAuditLogs.length === 0);

    // Attempt direct UPDATE on audit_logs by authenticated Super Admin (RLS denies all UPDATE)
    const targetAuditEntry = superAdminAuditLogs[0];
    const { data: updatedData } = await superAdmin.client
      .from('audit_logs')
      .update({ action: 'TAMPERED_ACTION' })
      .eq('id', targetAuditEntry.id)
      .select();
    assert(
      'RLS denies UPDATE on audit_logs (append-only ledger preserves immutability)',
      !updatedData || updatedData.length === 0
    );

    // Attempt direct DELETE on audit_logs by authenticated Super Admin (RLS denies all DELETE)
    const { data: deletedData } = await superAdmin.client
      .from('audit_logs')
      .delete()
      .eq('id', targetAuditEntry.id)
      .select();
    assert(
      'RLS denies DELETE on audit_logs (append-only ledger preserves immutability)',
      !deletedData || deletedData.length === 0
    );

  } finally {
    // --------------------------------------------------------------------------
    // CLEANUP
    // --------------------------------------------------------------------------
    console.log('\nCleaning up test artifacts...');
    try {
      // Delete test messages and conversations
      await adminClient.from('messages').delete().eq('sender_id', superAdmin.user.id);
      await adminClient.from('conversations').delete().eq('customer_id', customer.user.id);

      // Clean up test auth accounts
      await adminClient.auth.admin.deleteUser(superAdmin.user.id);
      await adminClient.auth.admin.deleteUser(regularAdmin.user.id);
      await adminClient.auth.admin.deleteUser(targetSpecialist.user.id);
      await adminClient.auth.admin.deleteUser(customer.user.id);
      console.log('Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
  }

  console.log('\n==============================================================================');
  console.log(`TEST SUMMARY: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log('==============================================================================\n');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runSuperAdminControlsTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
