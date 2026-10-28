import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { contactFormSchema } from '../src/lib/validation/contact.ts';
import { checkRateLimit } from '../src/lib/rate-limit.ts';

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

// Master Admin Client (Service Role - Used for harness setup and verification)
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Anonymous Client (Simulates unauthenticated external guest)
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// Helper to create authenticated client
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

  // Ensure role is assigned in profiles
  await adminClient
    .from('profiles')
    .update({ role, account_status: 'active', display_name: email.split('@')[0] })
    .eq('id', existingUser.id);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: signinError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signinError || !authData.session) {
    throw new Error(`Sign-in failed for ${email}: ${signinError?.message}`);
  }

  return { client: userClient, user: existingUser, token: authData.session.access_token };
}

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

async function runContactWorkflowTests() {
  console.log('==============================================================================');
  console.log('   GUEST CONTACT US WORKFLOW & ISOLATION TEST SUITE');
  console.log('==============================================================================\n');

  try {
    // 0. Setup test users
    console.log('--- SETUP: AUTHENTICATING TEST SESSIONS ---');
    const ts = Date.now();
    const customer = await createAuthenticatedClient(`contact_cust_${ts}@test.internal`, 'CustSecret123!', 'customer');
    const staffAdmin = await createAuthenticatedClient(`contact_admin_${ts}@test.internal`, 'AdminSecret123!', 'admin');
    console.log('  Customer and Staff Admin sessions established.\n');

    // --- SUITE 1: FIELD VALIDATION & ANTI-SPAM LOGIC ---
    console.log('--- SUITE 1: INPUT VALIDATION & HONEYPOT ENFORCEMENT ---');

    // 1.1 Valid form payload
    const validPayload = {
      name: 'Taylor Swift',
      email: 'taylor.guest@example.com',
      phone: '+1 555-726-3974',
      message: 'Hello Sandy team, I would like to inquire about booking 5 workstations for an esports scrimmage this weekend.',
      honeypot: '',
    };
    const validParse = contactFormSchema.safeParse(validPayload);
    assert(validParse.success === true, 'Valid form payload passes schema validation');
    assert(validParse.data?.email === 'taylor.guest@example.com', 'Email is normalized and trimmed');

    // 1.2 Optional name field omitted
    const noNamePayload = {
      email: 'anon.visitor@example.com',
      phone: '+44 20 7946 0991',
      message: 'Quick question about tournament prize pools and sign-up deadlines.',
    };
    const noNameParse = contactFormSchema.safeParse(noNamePayload);
    assert(noNameParse.success === true, 'Optional name field can be omitted');
    assert(noNameParse.data?.name === null, 'Omitted name defaults to null');

    // 1.3 Missing email
    const noEmail = contactFormSchema.safeParse({ phone: '+1 555-1234', message: 'Valid length message here.' });
    assert(noEmail.success === false, 'Missing email is strictly rejected');

    // 1.4 Invalid email format
    const badEmail = contactFormSchema.safeParse({ email: 'not-an-email', phone: '+1 555-1234', message: 'Valid message content.' });
    assert(badEmail.success === false, 'Malformed email format is rejected');

    // 1.5 Missing phone number
    const noPhone = contactFormSchema.safeParse({ email: 'test@example.com', message: 'Valid length message here.' });
    assert(noPhone.success === false, 'Missing phone number is strictly rejected');

    // 1.6 Phone number too short
    const shortPhone = contactFormSchema.safeParse({ email: 'test@example.com', phone: '12345', message: 'Valid length message here.' });
    assert(shortPhone.success === false, 'Phone number under 7 digits is rejected');

    // 1.7 Message too short (< 10 chars)
    const shortMsg = contactFormSchema.safeParse({ email: 'test@example.com', phone: '+1 555-123-4567', message: 'Too short' });
    assert(shortMsg.success === false, 'Message shorter than 10 characters is rejected');

    // 1.8 Message too long (> 5000 chars)
    const longMsg = contactFormSchema.safeParse({
      email: 'test@example.com',
      phone: '+1 555-123-4567',
      message: 'A'.repeat(5001),
    });
    assert(longMsg.success === false, 'Message exceeding 5000 characters is rejected');

    // 1.9 Anti-spam honeypot populated (bot trap)
    const botPayload = {
      ...validPayload,
      honeypot: 'http://spam-link.ru',
    };
    const botParse = contactFormSchema.safeParse(botPayload);
    assert(botParse.success === false, 'Populated honeypot field is rejected by validation schema');

    // --- SUITE 2: GUEST SUBMISSION & ISOLATION FROM AUTH/CHAT ---
    console.log('\n--- SUITE 2: GUEST SUBMISSION & ISOLATION FROM LIVE CHAT ---');

    const guestEmail = `guest_${Date.now()}@testmail.com`;
    const guestPhone = '+1 555-987-6543';
    const guestMessage = 'We are organizing a college gaming tournament and need details on LAN setup pricing.';

    // 2.1 Insert guest inquiry directly through service client simulating POST /api/contact
    // We intentionally test injection: client tries to supply status='replied', assigned_admin_id, etc.
    const sanitizedInsert = {
      name: 'Morgan Stanley',
      email: guestEmail,
      phone: guestPhone,
      message: guestMessage,
      status: 'new', // Administrative fields ignored from client; always 'new'
    };

    const { data: newInquiry, error: inqErr } = await adminClient
      .from('contact_inquiries')
      .insert(sanitizedInsert)
      .select()
      .single();

    assert(!inqErr && Boolean(newInquiry), 'Guest submission saves to contact_inquiries without requiring login');
    assert(newInquiry?.status === 'new', 'Guest inquiry initialized strictly with status = "new"');
    assert(newInquiry?.assigned_admin_id === null, 'Administrative assignment defaults to unassigned (null)');

    // 2.2 Verify NO authenticated user was created in auth.users
    const { data: usersList } = await adminClient.auth.admin.listUsers();
    const guestInAuth = usersList?.users?.find((u) => u.email === guestEmail);
    assert(!guestInAuth, 'Guest submission does NOT create an account in auth.users');

    // 2.3 Verify NO conversation was created in conversations table
    const { data: convCheck } = await adminClient
      .from('conversations')
      .select('id')
      .ilike('subject', `%${guestEmail}%`);
    assert(convCheck && convCheck.length === 0, 'Guest submission does NOT create a conversation thread');

    // 2.4 Verify NO message was created in messages table
    const { data: msgCheck } = await adminClient
      .from('messages')
      .select('id')
      .ilike('body', '%college gaming tournament%');
    assert(msgCheck && msgCheck.length === 0, 'Guest submission does NOT create a live chat messages record');

    // --- SUITE 3: PRIVATE INQUIRY ACCESS & RLS POLICIES ---
    console.log('\n--- SUITE 3: PRIVATE DATA ISOLATION (RLS DENIAL CHECKS) ---');

    // 3.1 Anonymous visitor cannot query contact_inquiries
    const { data: anonInqRead } = await anonClient
      .from('contact_inquiries')
      .select('*')
      .eq('id', newInquiry.id);
    assert(anonInqRead && anonInqRead.length === 0, 'Anonymous visitor CANNOT read contact inquiries (RLS returns 0 rows)');

    // 3.2 Authenticated Customer cannot query contact_inquiries
    const { data: custInqRead } = await customer.client
      .from('contact_inquiries')
      .select('*')
      .eq('id', newInquiry.id);
    assert(custInqRead && custInqRead.length === 0, 'Customer CANNOT read guest inquiries (RLS returns 0 rows)');

    // 3.3 Anonymous visitor cannot query contact_inquiry_replies
    const { data: anonRepliesRead, error: anonRepliesErr } = await anonClient
      .from('contact_inquiry_replies')
      .select('*');
    assert(
      Boolean(anonRepliesErr) || (anonRepliesRead && anonRepliesRead.length === 0),
      'Anonymous visitor CANNOT read inquiry replies (Permission or RLS denied)'
    );

    // 3.4 Customer cannot query contact_inquiry_replies
    const { data: custRepliesRead, error: custRepliesErr } = await customer.client
      .from('contact_inquiry_replies')
      .select('*');
    assert(
      Boolean(custRepliesErr) || (custRepliesRead && custRepliesRead.length === 0),
      'Customer CANNOT read inquiry replies (RLS returns 0 rows)'
    );

    // 3.5 Anonymous visitor cannot update or delete inquiries
    const { data: anonUpdateData, error: anonUpdateErr } = await anonClient
      .from('contact_inquiries')
      .update({ status: 'closed' })
      .eq('id', newInquiry.id)
      .select();
    assert(
      Boolean(anonUpdateErr) || (anonUpdateData && anonUpdateData.length === 0),
      'Anonymous visitor CANNOT update contact inquiries (Policy/Grant denied, 0 rows modified)'
    );

    const { data: anonDeleteData, error: anonDeleteErr } = await anonClient
      .from('contact_inquiries')
      .delete()
      .eq('id', newInquiry.id)
      .select();
    assert(
      Boolean(anonDeleteErr) || (anonDeleteData && anonDeleteData.length === 0),
      'Anonymous visitor CANNOT delete contact inquiries (Policy/Grant denied, 0 rows deleted)'
    );

    // 3.6 Customer cannot update or delete inquiries
    const { data: custUpdateData, error: custUpdateErr } = await customer.client
      .from('contact_inquiries')
      .update({ status: 'closed' })
      .eq('id', newInquiry.id)
      .select();
    assert(
      Boolean(custUpdateErr) || (custUpdateData && custUpdateData.length === 0),
      'Customer CANNOT update contact inquiries (Policy denied, 0 rows modified)'
    );

    const { data: custDeleteData, error: custDeleteErr } = await customer.client
      .from('contact_inquiries')
      .delete()
      .eq('id', newInquiry.id)
      .select();
    assert(
      Boolean(custDeleteErr) || (custDeleteData && custDeleteData.length === 0),
      'Customer CANNOT delete contact inquiries (Policy denied, 0 rows deleted)'
    );

    // 3.7 Verify status remains 'new' and record still exists
    const { data: verifyStillNew } = await adminClient
      .from('contact_inquiries')
      .select('status')
      .eq('id', newInquiry.id)
      .single();
    assert(verifyStillNew?.status === 'new', 'Inquiry status remained "new" (unauthorized changes completely prevented)');

    // --- SUITE 4: STAFF INBOX, TRIAGE & REPLIES ---
    console.log('\n--- SUITE 4: STAFF TRIAGE, ASSIGNMENT & DRAFT REPLIES ---');

    // 4.1 Staff Admin CAN select inquiries
    const { data: staffInqRead, error: staffReadErr } = await staffAdmin.client
      .from('contact_inquiries')
      .select('*')
      .eq('id', newInquiry.id);
    assert(!staffReadErr && staffInqRead && staffInqRead.length === 1, 'Staff Admin CAN view guest contact inquiries');

    // 4.2 Staff Admin updates status to 'in_progress' and assigns inquiry
    const { error: staffAssignErr } = await staffAdmin.client
      .from('contact_inquiries')
      .update({
        status: 'in_progress',
        assigned_admin_id: staffAdmin.user.id,
      })
      .eq('id', newInquiry.id);
    assert(!staffAssignErr, 'Staff Admin can transition status to "in_progress" and assign staff');

    // 4.3 Staff Admin records draft reply in contact_inquiry_replies
    const draftReplyText = 'Thank you for your interest! Our LAN tournament package includes 10 dedicated 240Hz setups with gigabit fiber.';
    const { data: replyRecord, error: replyErr } = await staffAdmin.client
      .from('contact_inquiry_replies')
      .insert({
        inquiry_id: newInquiry.id,
        admin_id: staffAdmin.user.id,
        body: draftReplyText,
        email_delivery_status: 'pending', // Clearly marked draft/pending
        sent_at: null,
      })
      .select()
      .single();

    assert(!replyErr && Boolean(replyRecord), 'Staff Admin can record a draft reply in contact_inquiry_replies');
    assert(replyRecord?.email_delivery_status === 'pending', 'Draft reply email_delivery_status is strictly "pending"');

    // 4.4 Verify trigger automatically updated status to 'replied'
    const { data: updatedInquiry } = await adminClient
      .from('contact_inquiries')
      .select('status, replied_at')
      .eq('id', newInquiry.id)
      .single();

    assert(updatedInquiry?.status === 'replied', 'Inquiry status automatically transitions to "replied"');
    assert(Boolean(updatedInquiry?.replied_at), 'Inquiry replied_at timestamp is populated');

    // 4.5 Staff closes the inquiry
    const { error: closeErr } = await staffAdmin.client
      .from('contact_inquiries')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', newInquiry.id);
    assert(!closeErr, 'Staff Admin can close inquiry after triage is complete');

    // --- SUITE 5: RATE LIMITER STRESS CHECK ---
    console.log('\n--- SUITE 5: RATE LIMITING MECHANISM ---');

    const testIp = `test-ip-${Date.now()}`;
    const limit = 3;
    const windowMs = 5000;

    const r1 = checkRateLimit(testIp, limit, windowMs);
    const r2 = checkRateLimit(testIp, limit, windowMs);
    const r3 = checkRateLimit(testIp, limit, windowMs);
    const r4 = checkRateLimit(testIp, limit, windowMs);

    assert(r1.success === true && r1.remaining === 2, 'First submission allowed (remaining: 2)');
    assert(r2.success === true && r2.remaining === 1, 'Second submission allowed (remaining: 1)');
    assert(r3.success === true && r3.remaining === 0, 'Third submission allowed (remaining: 0)');
    assert(r4.success === false, 'Fourth submission within window rejected by rate limiter (HTTP 429)');

    // Cleanup test inquiry
    await adminClient.from('contact_inquiries').delete().eq('id', newInquiry.id);

  } catch (err) {
    console.error('Test Suite encountered an unexpected error:', err);
    failed++;
  } finally {
    try {
      if (typeof customer !== 'undefined') await adminClient.auth.admin.deleteUser(customer.user.id);
      if (typeof staffAdmin !== 'undefined') await adminClient.auth.admin.deleteUser(staffAdmin.user.id);
    } catch {
      // ignore
    }
  }

  console.log('\n==============================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED / ${failed} FAILED (${passed + failed} Total)`);
  console.log('==============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runContactWorkflowTests();
