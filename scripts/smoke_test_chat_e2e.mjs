import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const adminServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function runE2ETest() {
  console.log('=== RUNNING COMPREHENSIVE END-TO-END CHAT & REALTIME VERIFICATION ===\n');

  const testEmail = `e2e_gamer_${Date.now()}@gmail.com`;
  const testPassword = 'TestPassword123!';
  const testDisplayName = 'PhoenixWarrior';

  // 1. Visitor Registration
  console.log('[1/5] Testing registration of new visitor...');
  const { data: newUser, error: regError } = await adminServiceClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { display_name: testDisplayName },
  });

  if (regError || !newUser?.user) {
    throw new Error(`Registration failed: ${regError?.message}`);
  }

  await adminServiceClient.from('profiles').upsert({
    id: newUser.user.id,
    email: testEmail,
    display_name: testDisplayName,
    role: 'customer',
    account_status: 'active',
  });
  console.log(`✅ [PASS] Registered visitor "${testDisplayName}" (${newUser.user.id})`);

  // 2. Client Authentication & WebSocket Token Setup
  console.log('\n[2/5] Authenticating clients and establishing realtime token sessions...');
  const visitorClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: visitorAuth } = await visitorClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  await visitorClient.realtime.setAuth(visitorAuth.session.access_token);

  const adminClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: adminAuth } = await adminClient.auth.signInWithPassword({
    email: 'admin.sandysgaming@gmail.com',
    password: 'TestPassword123!',
  });
  await adminClient.realtime.setAuth(adminAuth.session.access_token);
  console.log('✅ [PASS] Both Visitor and Admin authenticated with active socket tokens.');

  // 3. Conversation Creation & Auto-Assignment
  console.log('\n[3/5] Creating visitor persistent conversation...');
  const { data: conv, error: convErr } = await visitorClient
    .from('conversations')
    .insert({
      customer_id: newUser.user.id,
      subject: "Tournament Rules & Schedule Inquiry",
      status: 'open',
    })
    .select()
    .single();

  if (convErr || !conv) throw new Error(`Conversation creation failed: ${convErr?.message}`);

  await adminServiceClient.from('conversation_assignments').insert({
    conversation_id: conv.id,
    admin_id: adminAuth.user.id,
    status: 'active',
  });
  console.log(`✅ [PASS] Conversation ${conv.id} assigned to Support Admin.`);

  // 4. Bi-directional WebSocket Channels
  console.log('\n[4/5] Subscribing both parties to real-time stream (chat:' + conv.id + ')...');
  let adminReceivedMessage = null;
  let visitorReceivedReply = null;

  const adminChannel = adminClient.channel(`chat:${conv.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conv.id}`,
    }, (payload) => {
      adminReceivedMessage = payload.new;
    });

  const visitorChannel = visitorClient.channel(`chat:${conv.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conv.id}`,
    }, (payload) => {
      visitorReceivedReply = payload.new;
    });

  await new Promise((resolve) => {
    let count = 0;
    const check = () => {
      count++;
      if (count === 2) resolve(true);
    };
    adminChannel.subscribe((s) => s === 'SUBSCRIBED' && check());
    visitorChannel.subscribe((s) => s === 'SUBSCRIBED' && check());
  });
  console.log('✅ [PASS] Both channels connected and subscribed to live database stream.');

  // 5. Test Live Messaging
  console.log('\n[5/5] Testing bi-directional instant messaging...');

  // A. Visitor -> Admin
  const visitorMsgBody = 'Hello Support! Can I register my team for the 2026 Championship?';
  await visitorClient.from('messages').insert({
    conversation_id: conv.id,
    sender_id: newUser.user.id,
    body: visitorMsgBody,
    message_type: 'text',
  });
  console.log('-> Visitor dispatched message to thread.');

  await new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (adminReceivedMessage?.body === visitorMsgBody || Date.now() - start > 6000) {
        clearInterval(interval);
        resolve(true);
      }
    }, 100);
  });

  if (!adminReceivedMessage || adminReceivedMessage.body !== visitorMsgBody) {
    throw new Error('FAILED: Admin did not receive visitor message in real time!');
  }
  console.log(`✅ [REAL-TIME SUCCESS] Admin received visitor message: "${adminReceivedMessage.body}"`);

  // B. Admin -> Visitor
  const adminReplyBody = 'Welcome PhoenixWarrior! Yes, team registration is open on our portal.';
  await adminClient.from('messages').insert({
    conversation_id: conv.id,
    sender_id: adminAuth.user.id,
    body: adminReplyBody,
    message_type: 'text',
  });
  console.log('-> Admin dispatched reply to thread.');

  await new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (visitorReceivedReply?.body === adminReplyBody || Date.now() - start > 6000) {
        clearInterval(interval);
        resolve(true);
      }
    }, 100);
  });

  if (!visitorReceivedReply || visitorReceivedReply.body !== adminReplyBody) {
    throw new Error('FAILED: Visitor did not receive admin reply in real time!');
  }
  console.log(`✅ [REAL-TIME SUCCESS] Visitor received admin reply: "${visitorReceivedReply.body}"`);

  // Cleanup test data
  await adminServiceClient.from('conversations').delete().eq('id', conv.id);
  await adminServiceClient.auth.admin.deleteUser(newUser.user.id);
  console.log('\n✅ Cleaned up temporary test persona and conversation.');

  console.log('\n🎉 ALL REAL-TIME CHAT & REGISTRATION VERIFICATION CRITERIA PASSED 100%!');
}

runE2ETest().catch((err) => {
  console.error('\n❌ E2E Test Error:', err);
  process.exit(1);
});
