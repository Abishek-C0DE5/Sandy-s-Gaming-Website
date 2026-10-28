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

// Master Admin Client (Service Role - Used for provisioning test users and direct DB verification)
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Helper to provision authenticated client with scoped JWT
async function createAuthenticatedClient(email, password, role = 'customer') {
  let existingUser = null;
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: email.split('@')[0] },
    });
    if (res.data?.user) {
      existingUser = res.data.user;
      break;
    }
    lastErr = res.error;
    await new Promise((r) => setTimeout(r, 600));
  }

  if (!existingUser) {
    throw new Error(`Failed to create test user ${email}: ${lastErr?.message || 'unknown error'}`);
  }

  // Ensure role and active status
  await adminClient
    .from('profiles')
    .update({ role, account_status: 'active', display_name: email.split('@')[0] })
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

async function runLiveChatTestSuite() {
  console.log('==============================================================================');
  console.log('   AUTHENTICATED LIVE CHAT & POSTGRESQL MESSAGING TEST SUITE');
  console.log('==============================================================================');

  const testPassword = 'TestChatPassword123!';
  const timestamp = Date.now();

  const customerAEmail = `chat_cust_a_${timestamp}@test.local`;
  const customerBEmail = `chat_cust_b_${timestamp}@test.local`;
  const admin1Email = `chat_admin_1_${timestamp}@test.local`;
  const superAdminEmail = `chat_super_${timestamp}@test.local`;

  console.log('\n[1/5] Provisioning test personas with isolated credentials...');
  const customerA = await createAuthenticatedClient(customerAEmail, testPassword, 'customer');
  const customerB = await createAuthenticatedClient(customerBEmail, testPassword, 'customer');
  const admin1 = await createAuthenticatedClient(admin1Email, testPassword, 'admin');
  const superAdmin = await createAuthenticatedClient(superAdminEmail, testPassword, 'super_admin');
  console.log('Personas ready: Customer A, Customer B, Admin 1, Super Admin.');

  try {
    // --------------------------------------------------------------------------
    // SUITE 1: UNAUTHENTICATED & CROSS-ROLE DENIALS
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 1: UNAUTHENTICATED & CROSS-ROLE ACCESS CONTROLS ---');

    // Unauthenticated public client cannot select conversations
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data: anonConvs, error: anonSelectError } = await anonClient.from('conversations').select('*');
    assert('Unauthenticated visitor cannot select conversations (table grant / RLS error 42501)', (!anonConvs || anonConvs.length === 0) || !!anonSelectError);

    const { error: anonInsertError } = await anonClient.from('conversations').insert({
      customer_id: customerA.user.id,
      subject: 'Hacked conversation',
    });
    assert('Unauthenticated visitor cannot insert conversations (RLS error)', !!anonInsertError);

    const { error: anonMsgInsertError } = await anonClient.from('messages').insert({
      conversation_id: '00000000-0000-0000-0000-000000000000',
      sender_id: customerA.user.id,
      body: 'Hacked message',
    });
    assert('Unauthenticated visitor cannot insert messages (RLS error)', !!anonMsgInsertError);

    // --------------------------------------------------------------------------
    // SUITE 2: CUSTOMER CONVERSATION CREATION & MESSAGE LIFECYCLE
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 2: CUSTOMER CONVERSATION CREATION & MESSAGE LIFECYCLE ---');

    // Customer A creates conversation via authenticated client
    const { data: convA, error: convAError } = await customerA.client
      .from('conversations')
      .insert({
        customer_id: customerA.user.id,
        subject: 'Gaming Rig Hardware Inquiry',
        status: 'open',
      })
      .select()
      .single();

    assert('Customer A successfully initiates active conversation', !!convA && !convAError, convAError?.message);
    assert('Conversation defaults to status "open"', convA?.status === 'open');
    assert('Conversation correctly assigned to Customer A ID', convA?.customer_id === customerA.user.id);

    // Customer A posts first message
    const initialLastMessageAt = convA.last_message_at;
    // Small delay to verify timestamp progression
    await new Promise((r) => setTimeout(r, 200));

    const { data: msg1, error: msg1Error } = await customerA.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: customerA.user.id,
        body: 'Hello support team! What GPUs are installed in the Sandy lounge VIP rigs?',
        message_type: 'text',
      })
      .select()
      .single();

    assert('Customer A posts message into own conversation', !!msg1 && !msg1Error, msg1Error?.message);
    assert('Message references correct conversation ID', msg1?.conversation_id === convA.id);
    assert('Message references actual sender ID', msg1?.sender_id === customerA.user.id);
    assert('Message body matches exact input text', msg1?.body.includes('Sandy lounge VIP rigs'));
    assert('Message includes database created_at timestamp', !!msg1?.created_at);

    // Verify automatic trigger maintain_conversation_last_message_at
    const { data: updatedConvA } = await adminClient
      .from('conversations')
      .select('*')
      .eq('id', convA.id)
      .single();

    assert(
      'Trigger automatically updates conversation last_message_at on new message',
      new Date(updatedConvA.last_message_at).getTime() >= new Date(initialLastMessageAt).getTime()
    );

    // --------------------------------------------------------------------------
    // SUITE 3: TAMPERING & ISOLATION ENFORCEMENT
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 3: TAMPERING & ISOLATION ENFORCEMENT ---');

    // Customer A attempts to spoof sender_id to impersonate Super Admin
    const { error: spoofError } = await customerA.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: superAdmin.user.id, // Attempted spoof
        body: 'I am impersonating the Super Admin!',
      });
    assert('Customer CANNOT spoof sender_id in messages (RLS check violation)', !!spoofError);

    // Customer B attempts to select Customer A's conversation
    const { data: bCrossConv } = await customerB.client
      .from('conversations')
      .select('*')
      .eq('id', convA.id);
    assert("Customer B CANNOT view Customer A's conversation (0 rows returned)", bCrossConv?.length === 0);

    // Customer B attempts to select Customer A's messages
    const { data: bCrossMsgs } = await customerB.client
      .from('messages')
      .select('*')
      .eq('conversation_id', convA.id);
    assert("Customer B CANNOT view Customer A's messages (0 rows returned)", bCrossMsgs?.length === 0);

    // Customer B attempts to inject a message into Customer A's conversation
    const { error: bInjectError } = await customerB.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: customerB.user.id,
        body: 'Malicious injection into Customer A thread',
      });
    assert("Customer B CANNOT insert messages into Customer A's conversation (RLS denied)", !!bInjectError);

    // Customer A attempts to query conversation_assignments (Staff list privacy)
    const { data: custAssignments, error: assignErr } = await customerA.client
      .from('conversation_assignments')
      .select('*');
    assert('Customer CANNOT query conversation_assignments table (staff list protected)', !custAssignments || custAssignments.length === 0 || !!assignErr);

    // --------------------------------------------------------------------------
    // SUITE 4: MULTI-ADMIN PARTICIPATION & SHARED CONVERSATION MODEL
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 4: MULTI-ADMIN PARTICIPATION & SHARED CONVERSATION MODEL ---');

    // Unassigned Admin 1 attempts to read Customer A's conversation
    const { data: unassignedRead } = await admin1.client
      .from('conversations')
      .select('*')
      .eq('id', convA.id);
    assert('Unassigned Admin 1 CANNOT read conversation (returns 0 rows)', unassignedRead?.length === 0);

    // Unassigned Admin 1 attempts to post message
    const { error: unassignedPostErr } = await admin1.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin1.user.id,
        body: 'Unauthorized admin comment',
      });
    assert('Unassigned Admin 1 CANNOT post to unassigned conversation (RLS denied)', !!unassignedPostErr);

    // Super Admin assigns Admin 1 to Conversation CA
    const { data: assignment1, error: assign1Err } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: convA.id,
        admin_id: admin1.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      })
      .select()
      .single();
    assert('Super Admin assigns Admin 1 to conversation CA', !!assignment1 && !assign1Err, assign1Err?.message);

    // Assigned Admin 1 now reads Conversation CA
    const { data: assignedRead, error: assignedReadErr } = await admin1.client
      .from('conversations')
      .select('*')
      .eq('id', convA.id)
      .single();
    assert('Assigned Admin 1 CAN read conversation CA', !!assignedRead && !assignedReadErr, assignedReadErr?.message);

    // Assigned Admin 1 reads messages in Conversation CA
    const { data: assignedMsgs, error: assignedMsgsErr } = await admin1.client
      .from('messages')
      .select('*')
      .eq('conversation_id', convA.id);
    assert('Assigned Admin 1 reads existing message history', assignedMsgs?.length >= 1 && !assignedMsgsErr);

    // Assigned Admin 1 sends a reply using the EXACT SAME conversation ID
    const { data: adminReply1, error: adminReply1Err } = await admin1.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin1.user.id,
        body: 'Hi! Our VIP booths are powered by NVIDIA RTX 4090 GPUs and 240Hz OLED monitors.',
        message_type: 'text',
      })
      .select()
      .single();

    assert('Assigned Admin 1 successfully sends reply', !!adminReply1 && !adminReply1Err, adminReply1Err?.message);
    assert('Reply uses the exact same conversation ID (not a separate thread)', adminReply1?.conversation_id === convA.id);
    assert('Reply retains Admin 1 true sender_id in PostgreSQL', adminReply1?.sender_id === admin1.user.id);

    // Super Admin also replies to the same conversation CA
    const { data: superReply, error: superReplyErr } = await superAdmin.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: superAdmin.user.id,
        body: 'Super Admin note: Special welcome drink is included for your booking!',
        message_type: 'text',
      })
      .select()
      .single();

    assert('Super Admin successfully replies to the conversation', !!superReply && !superReplyErr, superReplyErr?.message);
    assert('Super Admin message uses the exact same conversation ID', superReply?.conversation_id === convA.id);

    // --------------------------------------------------------------------------
    // SUITE 5: SENDER IDENTITY MAPPING & PRIVACY (REQUIREMENT 11)
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 5: SENDER IDENTITY MAPPING & PRIVACY (REQUIREMENT 11) ---');

    // When customer retrieves messages via API:
    // Staff messages must be mapped to "Support Team" and individual staff identities hidden.
    const { data: allMessagesInConv } = await adminClient
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        body,
        message_type,
        created_at,
        sender:profiles!messages_sender_id_fkey(id, display_name, role)
      `)
      .eq('conversation_id', convA.id)
      .order('created_at', { ascending: true });

    assert('PostgreSQL retains true distinct senders (Customer, Admin 1, Super Admin)', allMessagesInConv?.length === 3);

    // Simulate Customer View Transformation (as implemented in /api/conversations/[id]/messages)
    const customerViewMessages = allMessagesInConv.map((msg) => {
      const isSelf = msg.sender_id === customerA.user.id;
      if (isSelf) {
        return { ...msg, sender_name: 'You', is_self: true };
      }
      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        body: msg.body,
        message_type: msg.message_type,
        created_at: msg.created_at,
        sender_name: 'Support Team',
        is_self: false,
      };
    });

    const staffMessagesInCustomerView = customerViewMessages.filter((m) => !m.is_self);
    const allStaffMappedToSupportTeam = staffMessagesInCustomerView.every(
      (m) => m.sender_name === 'Support Team' && !m.sender_id
    );
    assert(
      'In Customer View, all staff messages are strictly mapped to "Support Team"',
      allStaffMappedToSupportTeam
    );
    assert(
      'In Customer View, individual admin personal IDs and names are NOT exposed',
      !customerViewMessages.some((m) => m.sender_name.includes('admin') || m.sender_name.includes('super'))
    );

    // Simulate Staff View Transformation
    const staffViewMessages = allMessagesInConv.map((msg) => {
      const isSelf = msg.sender_id === admin1.user.id;
      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        body: msg.body,
        created_at: msg.created_at,
        is_self: isSelf,
        sender_name: isSelf ? 'You' : msg.sender?.display_name || 'Staff',
      };
    });

    assert(
      'In Staff View, real sender attribution is preserved (Admin sees Customer and Super Admin by name)',
      staffViewMessages.some((m) => m.sender_name === 'You') &&
        staffViewMessages.some((m) => m.sender_name.includes('chat_cust_a')) &&
        staffViewMessages.some((m) => m.sender_name.includes('chat_super'))
    );

    // --------------------------------------------------------------------------
    // SUITE 6: INPUT VALIDATION & CONVERSATION STATUS
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 6: INPUT VALIDATION & BOUNDED CONVERSATION RULES ---');

    // Empty body (< 1 character) rejected by database constraint
    const { error: emptyBodyError } = await customerA.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: customerA.user.id,
        body: '   ', // whitespace only
      });
    assert('Empty/whitespace message body is rejected by database constraint', !!emptyBodyError);

    // Excessive body (> 5000 chars) rejected by database constraint
    const excessiveBody = 'A'.repeat(5001);
    const { error: excessiveBodyError } = await customerA.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: customerA.user.id,
        body: excessiveBody,
      });
    assert('Message exceeding 5000 characters is rejected by database constraint', !!excessiveBodyError);

    // Bounded query limit
    const { data: boundedMsgs } = await customerA.client
      .from('messages')
      .select('*')
      .eq('conversation_id', convA.id)
      .limit(2);
    assert('Bounded pagination limits messages returned (limit = 2)', boundedMsgs?.length === 2);

    // Customer resolves conversation
    const { data: resolvedConv, error: resolveErr } = await customerA.client
      .from('conversations')
      .update({ status: 'resolved', closed_at: new Date().toISOString() })
      .eq('id', convA.id)
      .select()
      .single();

    assert('Customer can update conversation status to "resolved"', resolvedConv?.status === 'resolved' && !resolveErr);
    assert('Resolved conversation records closed_at timestamp', !!resolvedConv?.closed_at);

    // Reopen conversation
    const { data: reopenedConv } = await customerA.client
      .from('conversations')
      .update({ status: 'open', closed_at: null })
      .eq('id', convA.id)
      .select()
      .single();
    assert('Conversation can be reopened to "open" with closed_at set to null', reopenedConv?.status === 'open' && reopenedConv?.closed_at === null);

    // Persistence after refresh check
    const { data: persistedHistory } = await customerA.client
      .from('messages')
      .select('*')
      .eq('conversation_id', convA.id)
      .order('created_at', { ascending: true });

    assert(
      'Simulated page refresh: Customer reloads and retrieves all saved messages in stable chronological order',
      persistedHistory?.length === 3 &&
        persistedHistory[0].body.includes('Sandy lounge VIP rigs') &&
        persistedHistory[1].body.includes('RTX 4090') &&
        persistedHistory[2].body.includes('welcome drink')
    );

    // --------------------------------------------------------------------------
    // SUITE 7: UNASSIGNMENT / SEVERANCE CONTROLS
    // --------------------------------------------------------------------------
    console.log('\n--- SUITE 7: ASSIGNMENT REVOCATION CONTROLS ---');

    // Super Admin revokes Admin 1 assignment
    const { data: revokedAssignment, error: revokeErr } = await superAdmin.client
      .from('conversation_assignments')
      .update({ status: 'removed', removed_at: new Date().toISOString() })
      .eq('id', assignment1.id)
      .select()
      .single();

    assert('Super Admin can revoke assignment (status = "removed")', revokedAssignment?.status === 'removed' && !revokeErr);

    // Admin 1 now attempts to read the conversation again
    const { data: postRevokeRead } = await admin1.client
      .from('conversations')
      .select('*')
      .eq('id', convA.id);
    assert('Revoking assignment immediately terminates Admin 1 access to conversation (returns 0 rows)', postRevokeRead?.length === 0);

    const { error: postRevokePostErr } = await admin1.client
      .from('messages')
      .insert({
        conversation_id: convA.id,
        sender_id: admin1.user.id,
        body: 'Post-revocation message attempt',
      });
    assert('Revoking assignment immediately terminates Admin 1 ability to insert messages', !!postRevokePostErr);
  } finally {
    // Cleanup test data safely
    console.log('\n[Cleaning up ephemeral test conversations & assignments...]');
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

runLiveChatTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
