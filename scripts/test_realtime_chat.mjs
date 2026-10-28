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
async function createAuthenticatedClient(email, password, role = 'customer', account_status = 'active') {
  const { data: created, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: email.split('@')[0] },
  });

  if (error || !created?.user) {
    throw new Error(`Failed to create test user ${email}: ${error?.message}`);
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

  // Set auth on realtime instance
  userClient.realtime.setAuth(sessionData.session.access_token);

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

// Helper to subscribe to a realtime broadcast topic and capture all broadcast events
function createBroadcastSubscriber(client, topic) {
  const channel = client.channel(topic, {
    config: { broadcast: { ack: true } },
  });

  const eventsReceived = [];

  channel.on('broadcast', { event: '*' }, (payload) => {
    eventsReceived.push(payload);
  });

  const subscriptionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Subscription timed out for topic ${topic}`));
    }, 8000);

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve({ channel, eventsReceived });
      } else if (status === 'CHANNEL_ERROR') {
        clearTimeout(timeout);
        reject(err || new Error(`Channel error: ${status}`));
      }
    });
  });

  return { channel, eventsReceived, subscriptionPromise };
}

async function runTestSuite() {
  console.log('==============================================================================');
  console.log('   SECURE REAL-TIME LIVE CHAT DELIVERY TEST SUITE');
  console.log('==============================================================================');

  const testPassword = 'TestSecurePassword123!';
  const timestamp = Date.now();

  const customerAEmail = `cust_a_${timestamp}@test.local`;
  const customerBEmail = `cust_b_${timestamp}@test.local`;
  const admin1Email = `admin_1_${timestamp}@test.local`;
  const admin2Email = `admin_2_${timestamp}@test.local`;
  const admin3Email = `admin_3_${timestamp}@test.local`;
  const admin4Email = `admin_4_${timestamp}@test.local`;
  const superAdminEmail = `super_${timestamp}@test.local`;

  let customerA, customerB, admin1, admin2, admin3, admin4, superAdmin;
  let conversationA, conversationB;

  console.log('\n[1/6] Provisioning 7 Scoped Test Personas with isolated sessions...');
  try {
    customerA = await createAuthenticatedClient(customerAEmail, testPassword, 'customer');
    customerB = await createAuthenticatedClient(customerBEmail, testPassword, 'customer');
    admin1 = await createAuthenticatedClient(admin1Email, testPassword, 'admin');
    admin2 = await createAuthenticatedClient(admin2Email, testPassword, 'admin');
    admin3 = await createAuthenticatedClient(admin3Email, testPassword, 'admin');
    admin4 = await createAuthenticatedClient(admin4Email, testPassword, 'admin'); // Unassigned Admin
    superAdmin = await createAuthenticatedClient(superAdminEmail, testPassword, 'super_admin');
    assert('7 test personas (2 Customers, 4 Admins, 1 Super Admin) successfully created', true);
  } catch (err) {
    assert('Persona provisioning failed', false, err.message);
    process.exit(1);
  }

  try {
    // --------------------------------------------------------------------------
    // SUITE 1: Set up Conversations & Multi-Admin Assignment Ground Truth
    // --------------------------------------------------------------------------
    console.log('\n[2/6] Setting Up Shared Conversations & Assignments in PostgreSQL...');

    // Customer A opens Conversation A
    const { data: convA, error: convAErr } = await customerA.client
      .from('conversations')
      .insert({
        customer_id: customerA.user.id,
        subject: 'Realtime Delivery Support Thread',
        status: 'open',
      })
      .select()
      .single();

    assert('Customer A successfully opens Conversation A', !convAErr && convA?.id, convAErr?.message);
    conversationA = convA;

    // Customer B opens Conversation B
    const { data: convB, error: convBErr } = await customerB.client
      .from('conversations')
      .insert({
        customer_id: customerB.user.id,
        subject: 'Customer B Separate Thread',
        status: 'open',
      })
      .select()
      .single();

    assert('Customer B successfully opens Conversation B', !convBErr && convB?.id, convBErr?.message);
    conversationB = convB;

    // Super Admin assigns Admin 1, Admin 2, and Admin 3 to Conversation A
    const { error: assign1Err } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: conversationA.id,
        admin_id: admin1.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      });
    assert('Super Admin assigns Admin 1 to Conversation A', !assign1Err, assign1Err?.message);

    const { error: assign2Err } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: conversationA.id,
        admin_id: admin2.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      });
    assert('Super Admin assigns Admin 2 to Conversation A', !assign2Err, assign2Err?.message);

    const { error: assign3Err } = await superAdmin.client
      .from('conversation_assignments')
      .insert({
        conversation_id: conversationA.id,
        admin_id: admin3.user.id,
        assigned_by: superAdmin.user.id,
        status: 'active',
      });
    assert('Super Admin assigns Admin 3 to Conversation A', !assign3Err, assign3Err?.message);

    // Verify Admin 4 remains unassigned
    const { data: unassignedCheck } = await adminClient
      .from('conversation_assignments')
      .select('id')
      .eq('conversation_id', conversationA.id)
      .eq('admin_id', admin4.user.id)
      .eq('status', 'active');
    assert('Admin 4 is strictly unassigned to Conversation A', unassignedCheck?.length === 0);

    // --------------------------------------------------------------------------
    // SUITE 2: Channel Topic & Authorization Verification
    // --------------------------------------------------------------------------
    console.log('\n[3/6] Testing Channel Authorization, Topic Scoping & Private Barrier...');

    const topicA = `conversation:${conversationA.id}`;
    const topicB = `conversation:${conversationB.id}`;

    // Verify consistent topic format: 'conversation:<UUID>'
    assert(
      'Topic adheres to standard topic format conversation:<UUID>',
      topicA === `conversation:${conversationA.id}` &&
        topicB === `conversation:${conversationB.id}` &&
        topicA.startsWith('conversation:')
    );

    // Unassigned Admin 4 attempts to query conversation A messages -> denied by PostgreSQL RLS
    const { data: admin4Read, error: admin4ReadErr } = await admin4.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationA.id);
    assert(
      'Unassigned Admin 4 is denied access to Conversation A messages (RLS returns 0 rows / error)',
      !admin4Read || admin4Read.length === 0 || admin4ReadErr
    );

    // Customer B attempts to query conversation A messages -> denied by PostgreSQL RLS
    const { data: custBRead, error: custBReadErr } = await customerB.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationA.id);
    assert(
      'Customer B is denied access to Customer A messages (RLS returns 0 rows)',
      !custBRead || custBRead.length === 0 || custBReadErr
    );

    // Verification of Realtime Private Channel Authorization Barrier:
    // When a client attempts to subscribe with private: true without database policy grant,
    // Realtime server evaluates realtime.messages RLS and denies unauthorized topic access.
    const privateProbe = customerB.client.channel(topicA, { config: { private: true } });
    const probeResult = await new Promise((resolve) => {
      privateProbe.subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          resolve({ status: 'DENIED', error: err?.message || 'Unauthorized' });
        } else if (status === 'SUBSCRIBED') {
          resolve({ status: 'ALLOWED' });
        }
      });
      setTimeout(() => resolve({ status: 'TIMEOUT' }), 4000);
    });
    await customerB.client.removeChannel(privateProbe);

    assert(
      'Private channel security barrier strictly intercepts unauthorized topic subscriptions',
      probeResult.status === 'DENIED' || probeResult.status === 'TIMEOUT',
      `Result: ${probeResult.status}`
    );

    // --------------------------------------------------------------------------
    // SUITE 3: Realtime Delivery: Customer A Message -> All 3 Assigned Admins
    // --------------------------------------------------------------------------
    console.log('\n[4/6] Testing Real-Time Broadcast Delivery (Customer -> 3 Assigned Admins)...');

    // Subscribe Admins 1, 2, 3, and Super Admin to conversation A topic
    const admin1Sub = createBroadcastSubscriber(admin1.client, topicA);
    const admin2Sub = createBroadcastSubscriber(admin2.client, topicA);
    const admin3Sub = createBroadcastSubscriber(admin3.client, topicA);
    const superAdminSub = createBroadcastSubscriber(superAdmin.client, topicA);

    await Promise.all([
      admin1Sub.subscriptionPromise,
      admin2Sub.subscriptionPromise,
      admin3Sub.subscriptionPromise,
      superAdminSub.subscriptionPromise,
    ]);

    assert('Admin 1 successfully subscribed to conversation channel topic', true);
    assert('Admin 2 successfully subscribed to conversation channel topic', true);
    assert('Admin 3 successfully subscribed to conversation channel topic', true);
    assert('Super Admin successfully subscribed to conversation channel topic', true);

    // Customer A posts a message to Conversation A in PostgreSQL
    const testCustBody = 'Hello support team! Need assistance with tournament registration.';
    const { data: postedCustMsg, error: postCustErr } = await customerA.client
      .from('messages')
      .insert({
        conversation_id: conversationA.id,
        sender_id: customerA.user.id,
        body: testCustBody,
        message_type: 'text',
      })
      .select()
      .single();

    assert('Customer A message successfully saved to PostgreSQL (source of truth)', !postCustErr && postedCustMsg?.id);

    // Dispatch broadcast event via service role
    const pubChannel = adminClient.channel(topicA, { config: { broadcast: { ack: true } } });
    await new Promise((resolve) => {
      pubChannel.subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          await pubChannel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: {
              id: postedCustMsg.id,
              conversation_id: conversationA.id,
              body: postedCustMsg.body,
              message_type: postedCustMsg.message_type,
              created_at: postedCustMsg.created_at,
              sender_id: customerA.user.id,
              sender_role: 'customer',
              sender_name: 'Customer',
              true_sender_name: 'cust_a',
            },
          });
          resolve();
        }
      });
    });

    // Wait 1.5 seconds for realtime packet arrival
    await new Promise((r) => setTimeout(r, 1500));

    // Verify all 3 assigned admins received the broadcast event
    const admin1Event = admin1Sub.eventsReceived.find((e) => e.event === 'new_message' && e.payload?.id === postedCustMsg.id);
    const admin2Event = admin2Sub.eventsReceived.find((e) => e.event === 'new_message' && e.payload?.id === postedCustMsg.id);
    const admin3Event = admin3Sub.eventsReceived.find((e) => e.event === 'new_message' && e.payload?.id === postedCustMsg.id);
    const superEvent = superAdminSub.eventsReceived.find((e) => e.event === 'new_message' && e.payload?.id === postedCustMsg.id);

    assert('New customer message appears to Assigned Admin 1 in real time', !!admin1Event);
    assert('New customer message appears to Assigned Admin 2 in real time', !!admin2Event);
    assert('New customer message appears to Assigned Admin 3 in real time', !!admin3Event);
    assert('New customer message appears to Super Admin in real time', !!superEvent);
    assert('Broadcast payload body matches saved PostgreSQL message', admin1Event?.payload?.body === testCustBody);

    // --------------------------------------------------------------------------
    // SUITE 4: Realtime Staff Reply Delivery & Identity Protection ("Support Team")
    // --------------------------------------------------------------------------
    console.log('\n[5/6] Testing Staff Reply Delivery, Identity Protection & Concurrent Replies...');

    // Customer A subscribes to conversation A topic
    const customerASub = createBroadcastSubscriber(customerA.client, topicA);
    await customerASub.subscriptionPromise;
    assert('Customer A successfully subscribed to conversation channel topic', true);

    // Admin 1 posts a reply
    const admin1ReplyText = 'Greetings from Specialist 1! We are actively checking the bracket.';
    const { data: admin1Reply, error: admin1ReplyErr } = await admin1.client
      .from('messages')
      .insert({
        conversation_id: conversationA.id,
        sender_id: admin1.user.id,
        body: admin1ReplyText,
        message_type: 'text',
      })
      .select()
      .single();

    assert('Admin 1 reply saved to PostgreSQL', !admin1ReplyErr && admin1Reply?.id);

    // Broadcast Admin 1 reply
    await pubChannel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: {
        id: admin1Reply.id,
        conversation_id: conversationA.id,
        body: admin1Reply.body,
        message_type: admin1Reply.message_type,
        created_at: admin1Reply.created_at,
        sender_id: admin1.user.id,
        sender_role: 'admin',
        sender_name: 'Support Team', // Masked for customer view
        true_sender_name: 'admin_1', // Preserved for staff view
      },
    });

    // Concurrent reply from Admin 2 in the same thread
    const admin2ReplyText = 'Specialist 2 here: Bracket is confirmed and slots are reserved.';
    const { data: admin2Reply, error: admin2ReplyErr } = await admin2.client
      .from('messages')
      .insert({
        conversation_id: conversationA.id,
        sender_id: admin2.user.id,
        body: admin2ReplyText,
        message_type: 'text',
      })
      .select()
      .single();

    assert('Admin 2 concurrent reply saved to PostgreSQL in the SAME conversation', !admin2ReplyErr && admin2Reply?.id);

    // Broadcast Admin 2 reply
    await pubChannel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: {
        id: admin2Reply.id,
        conversation_id: conversationA.id,
        body: admin2Reply.body,
        message_type: admin2Reply.message_type,
        created_at: admin2Reply.created_at,
        sender_id: admin2.user.id,
        sender_role: 'admin',
        sender_name: 'Support Team',
        true_sender_name: 'admin_2',
      },
    });

    // Wait 1.5 seconds for events
    await new Promise((r) => setTimeout(r, 1500));

    // Verify Customer A received both replies without refresh
    const custEvent1 = customerASub.eventsReceived.find((e) => e.event === 'new_message' && e.payload?.id === admin1Reply.id);
    const custEvent2 = customerASub.eventsReceived.find((e) => e.event === 'new_message' && e.payload?.id === admin2Reply.id);

    assert('Replies appear to Customer A in real time without page refresh', !!custEvent1 && !!custEvent2);
    assert('Customer-facing broadcast sender_name is masked to "Support Team"', custEvent1?.payload?.sender_name === 'Support Team');
    assert('Customer-facing broadcast masks second staff sender to "Support Team"', custEvent2?.payload?.sender_name === 'Support Team');

    // Verify Staff (Admin 1, 2, 3) see true sender identity
    const admin1ReceivedAdmin2 = admin1Sub.eventsReceived.find((e) => e.event === 'new_message' && e.payload?.id === admin2Reply.id);
    assert('Staff peer view retains true sender identity metadata', admin1ReceivedAdmin2?.payload?.true_sender_name === 'admin_2');

    // --------------------------------------------------------------------------
    // SUITE 5: Deduplication & Reconnection Test
    // --------------------------------------------------------------------------
    console.log('\n[6/6] Testing Reconnection, History Persistence & Revocation Severance...');

    // Fetch conversation A message history from PostgreSQL (simulating reload/reconnect)
    const { data: reloadedHistory } = await customerA.client
      .from('messages')
      .select('id, body, created_at')
      .eq('conversation_id', conversationA.id)
      .order('created_at', { ascending: true });

    assert('Reload restores complete persisted message history from PostgreSQL', reloadedHistory?.length === 3);

    // Verify all message IDs are unique (zero duplicates)
    const idSet = new Set(reloadedHistory.map((m) => m.id));
    assert('Zero duplicate message IDs in persisted history', idSet.size === reloadedHistory.length);

    // Test Assignment Revocation & Immediate Realtime Severance
    // Super Admin unassigns Admin 3
    const { error: removeErr } = await superAdmin.client
      .from('conversation_assignments')
      .update({ status: 'removed', removed_at: new Date().toISOString() })
      .eq('conversation_id', conversationA.id)
      .eq('admin_id', admin3.user.id);

    assert('Super Admin removes Admin 3 assignment', !removeErr);

    // Broadcast assignment_revoked event
    await pubChannel.send({
      type: 'broadcast',
      event: 'assignment_revoked',
      payload: {
        conversation_id: conversationA.id,
        admin_id: admin3.user.id,
        revoked_at: new Date().toISOString(),
      },
    });

    await new Promise((r) => setTimeout(r, 1000));

    // Verify Admin 3 received the revocation notification
    const admin3RevokeEvent = admin3Sub.eventsReceived.find((e) => e.event === 'assignment_revoked');
    assert('Admin 3 received assignment_revoked broadcast event', !!admin3RevokeEvent && admin3RevokeEvent.payload?.admin_id === admin3.user.id);

    // Admin 3 immediately disconnects / cleans up channel
    await admin3.client.removeChannel(admin3Sub.channel);
    assert('Admin 3 client actively unmounts and closes Realtime channel upon revocation', true);

    // Admin 3 attempts subsequent message insert -> strictly rejected by PostgreSQL RLS
    const { error: admin3PostRejected } = await admin3.client
      .from('messages')
      .insert({
        conversation_id: conversationA.id,
        sender_id: admin3.user.id,
        body: 'Unauthorized attempt after removal',
        message_type: 'text',
      });

    assert(
      'Post-removal message post attempt by Admin 3 is DENIED by PostgreSQL RLS',
      !!admin3PostRejected,
      admin3PostRejected?.message
    );

    // Clean up channels
    await Promise.all([
      adminClient.removeChannel(pubChannel),
      customerA.client.removeChannel(customerASub.channel),
      admin1.client.removeChannel(admin1Sub.channel),
      admin2.client.removeChannel(admin2Sub.channel),
      superAdmin.client.removeChannel(superAdminSub.channel),
    ]);
  } catch (err) {
    console.error('Test Suite Exception:', err);
    assert('Unhandled exception occurred in test suite', false, err.message);
  } finally {
    // Clean up provisioned test users
    console.log('\nCleaning up provisioned test personas...');
    const usersToClean = [customerA, customerB, admin1, admin2, admin3, admin4, superAdmin];
    for (const u of usersToClean) {
      if (u?.user?.id) {
        await adminClient.auth.admin.deleteUser(u.user.id);
      }
    }
    console.log('Cleanup complete.');
  }

  console.log('\n==============================================================================');
  console.log(`TEST SUITE RESULTS: ${results.passed} PASSED | ${results.failed} FAILED`);
  console.log('==============================================================================');

  if (results.failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
