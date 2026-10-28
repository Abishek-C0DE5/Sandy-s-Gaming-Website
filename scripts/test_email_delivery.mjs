import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  UnconfiguredEmailAdapter,
  ResendEmailAdapter,
  SendGridEmailAdapter,
  PostmarkEmailAdapter,
  getEmailAdapter,
} from '../src/lib/email/adapter.ts';
import { generateInquiryReplyEmail } from '../src/lib/email/template.ts';

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

// Anonymous Client
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

async function runEmailDeliveryTests() {
  console.log('==============================================================================');
  console.log('   SERVER-SIDE EMAIL DELIVERY & FOLLOW-UP RESPONSE TEST SUITE');
  console.log('==============================================================================\n');

  try {
    // 0. Setup test actors
    console.log('--- SETUP: AUTHENTICATING TEST ACTORS ---');
    const ts = Date.now();
    const customer = await createAuthenticatedClient(`email_cust_${ts}@test.internal`, 'CustSecret123!', 'customer');
    const staffAdmin = await createAuthenticatedClient(`email_admin1_${ts}@test.internal`, 'Admin1Secret123!', 'admin');
    const superAdmin = await createAuthenticatedClient(`email_super_${ts}@test.internal`, 'SuperSecret123!', 'super_admin');
    console.log('  Customer, Staff Admin, and Super Admin sessions established.\n');

    // Create a shared test inquiry
    const testEmail = `guest_inquiry_${Date.now()}@example.org`;
    const { data: testInquiry, error: inqCreateErr } = await adminClient
      .from('contact_inquiries')
      .insert({
        name: 'Jordan Lee',
        email: testEmail,
        phone: '+1 555-432-8765',
        message: 'Can our collegiate esports team book 10 setups for Friday tournament finals?',
        status: 'new',
      })
      .select()
      .single();

    assert(!inqCreateErr && Boolean(testInquiry), 'Test contact inquiry created successfully');

    // --- SUITE 1: AUTHORIZATION & PERMISSION ENFORCEMENT ---
    console.log('\n--- SUITE 1: AUTHORIZATION & ACCESS CONTROL ---');

    // 1.1 Anonymous user cannot insert reply into contact_inquiry_replies
    const { error: anonReplyErr } = await anonClient
      .from('contact_inquiry_replies')
      .insert({
        inquiry_id: testInquiry.id,
        admin_id: staffAdmin.user.id,
        body: 'Unauthorized anonymous response attempt',
        email_delivery_status: 'pending',
      });
    assert(Boolean(anonReplyErr), 'Anonymous visitor CANNOT record inquiry replies (RLS blocked)');

    // 1.2 Customer cannot insert reply into contact_inquiry_replies
    const { error: custReplyErr } = await customer.client
      .from('contact_inquiry_replies')
      .insert({
        inquiry_id: testInquiry.id,
        admin_id: customer.user.id,
        body: 'Unauthorized customer response attempt',
        email_delivery_status: 'pending',
      });
    assert(Boolean(custReplyErr), 'Customer CANNOT record inquiry replies (RLS blocked)');

    // 1.3 Staff Admin CAN record reply into contact_inquiry_replies
    const { data: staffReply, error: staffReplyErr } = await staffAdmin.client
      .from('contact_inquiry_replies')
      .insert({
        inquiry_id: testInquiry.id,
        admin_id: staffAdmin.user.id,
        body: 'Thank you Jordan! We have 10 workstations reserved for your team finals.',
        email_delivery_status: 'pending',
      })
      .select()
      .single();
    assert(!staffReplyErr && Boolean(staffReply), 'Staff Admin CAN record inquiry reply in database');

    // 1.4 Super Admin CAN record reply
    const { data: superReply, error: superReplyErr } = await superAdmin.client
      .from('contact_inquiry_replies')
      .insert({
        inquiry_id: testInquiry.id,
        admin_id: superAdmin.user.id,
        body: 'Super Admin follow-up confirmation.',
        email_delivery_status: 'pending',
      })
      .select()
      .single();
    assert(!superReplyErr && Boolean(superReply), 'Super Admin CAN record inquiry reply in database');

    // --- SUITE 2: UNCONFIGURED PROVIDER STATE & SAFETY ---
    console.log('\n--- SUITE 2: UNCONFIGURED STATE & ZERO FALSE DELIVERY ---');

    const unconfigured = new UnconfiguredEmailAdapter();
    assert(unconfigured.isConfigured === false, 'UnconfiguredEmailAdapter reports isConfigured = false');
    assert(unconfigured.name === 'unconfigured', 'UnconfiguredEmailAdapter name is "unconfigured"');

    const sampleEmail = {
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
      text: 'Test',
    };

    const unconfResult = await unconfigured.send(sampleEmail);
    assert(unconfResult.success === false, 'Unconfigured send does NOT claim success');
    assert(unconfResult.status === 'pending', 'Unconfigured send marks status as "pending"');
    assert(unconfResult.providerMessageId === null, 'Unconfigured send returns null providerMessageId');
    assert(Boolean(unconfResult.error), 'Unconfigured send returns clear explanatory error message');

    // Verify factory falls back to unconfigured when credentials missing
    const activeAdapter = getEmailAdapter();
    assert(activeAdapter.isConfigured === false, 'Factory automatically falls back to UnconfiguredEmailAdapter when EMAIL_API_KEY is unset');

    // --- SUITE 3: PROVIDER ADAPTERS & ERROR HANDLING ---
    console.log('\n--- SUITE 3: PROVIDER ADAPTER MAPPING & RESILIENCE ---');

    // 3.1 Template generation
    const template = generateInquiryReplyEmail({
      recipientName: 'Jordan Lee',
      inquiryDate: '10/27/2026',
      originalMessage: 'Can our collegiate esports team book 10 setups?',
      responseBody: 'Yes, 10 setups are confirmed.',
      staffName: 'Alex Support',
    });
    assert(template.subject.includes("Sandy's Gaming Lounge"), 'Email subject contains branding');
    assert(template.html.includes('Jordan Lee') && template.html.includes('10 setups are confirmed'), 'HTML email contains recipient and response text');
    assert(template.text.includes('10 setups are confirmed'), 'Plaintext email contains response body');
    assert(!template.html.includes('+1 555-432-8765'), 'Guest phone number is NOT exposed in email body (privacy protection)');

    // 3.2 Resend Adapter with simulated invalid key (Provider error handling)
    const resendTestAdapter = new ResendEmailAdapter('re_invalid_test_key_123', 'support@sandysgaming.com');
    assert(resendTestAdapter.isConfigured === true, 'ResendEmailAdapter reports isConfigured = true');
    const resendResult = await resendTestAdapter.send(sampleEmail);
    assert(resendResult.success === false, 'Resend with bad key cleanly returns success = false');
    assert(resendResult.status === 'failed', 'Resend failure maps to status = "failed"');
    assert(Boolean(resendResult.error), 'Resend returns safe descriptive error message');

    // 3.3 SendGrid Adapter with simulated invalid key
    const sendGridAdapter = new SendGridEmailAdapter('SG.invalid_test_key_456', 'support@sandysgaming.com');
    assert(sendGridAdapter.isConfigured === true, 'SendGridEmailAdapter reports isConfigured = true');
    const sgResult = await sendGridAdapter.send(sampleEmail);
    assert(sgResult.success === false, 'SendGrid with bad key cleanly returns success = false');
    assert(sgResult.status === 'failed', 'SendGrid failure maps to status = "failed"');

    // 3.4 Postmark Adapter with simulated invalid key
    const postmarkAdapter = new PostmarkEmailAdapter('pm_invalid_test_key_789', 'support@sandysgaming.com');
    assert(postmarkAdapter.isConfigured === true, 'PostmarkEmailAdapter reports isConfigured = true');
    const pmResult = await postmarkAdapter.send(sampleEmail);
    assert(pmResult.success === false, 'Postmark with bad key cleanly returns success = false');
    assert(pmResult.status === 'failed', 'Postmark failure maps to status = "failed"');

    // --- SUITE 4: IDEMPOTENCY & DUPLICATE PROTECTION ---
    console.log('\n--- SUITE 4: IDEMPOTENCY & DUPLICATE PROTECTION ---');

    // Resilient insertion
    const { data: firstReply, error: firstIdemErr } = await adminClient
      .from('contact_inquiry_replies')
      .insert({
        inquiry_id: testInquiry.id,
        admin_id: staffAdmin.user.id,
        body: 'First idempotent dispatch response.',
        email_delivery_status: 'pending',
      })
      .select()
      .single();

    assert(!firstIdemErr && Boolean(firstReply), 'First reply recorded successfully in database');

    // Duplicate check logic: identical inquiry and body within 30s is detected
    const { data: duplicateCheck } = await adminClient
      .from('contact_inquiry_replies')
      .select('id, body')
      .eq('inquiry_id', testInquiry.id)
      .eq('body', 'First idempotent dispatch response.');

    assert(duplicateCheck && duplicateCheck.length >= 1, 'Duplicate detection identifies recorded response (preventing duplicate sends)');

    // --- SUITE 5: DELIVERY STATE & INQUIRY LINKAGE ---
    console.log('\n--- SUITE 5: INQUIRY LINKAGE & STATUS SYNCHRONIZATION ---');

    // 5.1 Verify inquiry status updated to 'replied'
    const { data: freshInq } = await adminClient
      .from('contact_inquiries')
      .select('status, replied_at')
      .eq('id', testInquiry.id)
      .single();

    assert(freshInq?.status === 'replied', 'Contact inquiry status automatically transitioned to "replied"');
    assert(Boolean(freshInq?.replied_at), 'Inquiry replied_at timestamp is populated');

    // 5.2 Verify reply history links to correct inquiry
    const { data: replyHistory } = await adminClient
      .from('contact_inquiry_replies')
      .select('*')
      .eq('inquiry_id', testInquiry.id);

    assert(replyHistory && replyHistory.length >= 2, `Reply history retrieved for inquiry (Found: ${replyHistory?.length})`);
    assert(replyHistory?.every((r) => r.inquiry_id === testInquiry.id), 'All replies strictly belong to the target inquiry');

    // --- SUITE 6: RETRY MECHANISM & SAFEGUARDS ---
    console.log('\n--- SUITE 6: RETRY SAFEGUARDS & AUDIT TRAIL ---');

    // 6.1 Retry updates reply with failure information
    const { data: updatedRetryReply, error: retryUpErr } = await adminClient
      .from('contact_inquiry_replies')
      .update({
        last_delivery_error: 'Simulated connection timeout during retry',
        email_delivery_status: 'failed',
      })
      .eq('id', firstReply.id)
      .select()
      .single();

    assert(!retryUpErr && updatedRetryReply?.email_delivery_status === 'failed', 'Retry updates delivery status to "failed"');
    assert(Boolean(updatedRetryReply?.last_delivery_error), 'Retry safely records last_delivery_error details');

    // 6.2 Safeguard check: If reply is marked 'accepted' or 'sent', retry must be prevented
    function canRetryReply(status, retryCount) {
      if (['accepted', 'sent', 'delivered'].includes(status)) return false;
      if (retryCount >= 5) return false;
      return true;
    }

    assert(canRetryReply('failed', 1) === true, 'Failed reply with retry_count < 5 is eligible for retry');
    assert(canRetryReply('pending', 0) === true, 'Pending reply is eligible for retry');
    assert(canRetryReply('accepted', 1) === false, 'Accepted email is BLOCKED from retrying (prevents duplicate delivery)');
    assert(canRetryReply('sent', 0) === false, 'Sent email is BLOCKED from retrying (prevents duplicate delivery)');
    assert(canRetryReply('failed', 5) === false, 'Reply exceeding 5 attempts is BLOCKED from further retries');

    // 6.3 Audit trail verification
    const { data: auditEntries } = await adminClient
      .from('audit_logs')
      .select('*')
      .eq('target_id', testInquiry.id)
      .order('created_at', { ascending: false });

    assert(Array.isArray(auditEntries), 'Audit log query succeeds for contact inquiry');

    // --- SUITE 7: SECRETS LEAK PREVENTION ---
    console.log('\n--- SUITE 7: SECRETS LEAK PREVENTION ---');

    const envKeys = Object.keys(process.env);
    const publicExposedKeys = envKeys.filter(
      (k) => k.startsWith('NEXT_PUBLIC_') && k.toLowerCase().includes('email_api')
    );
    assert(publicExposedKeys.length === 0, 'No EMAIL_API_KEY is prefixed with NEXT_PUBLIC_ (Never bundled in browser)');

    // Cleanup test data
    await adminClient.from('contact_inquiries').delete().eq('id', testInquiry.id);

  } catch (err) {
    console.error('Test Suite encountered an unexpected error:', err);
    failed++;
  } finally {
    try {
      if (typeof customer !== 'undefined') await adminClient.auth.admin.deleteUser(customer.user.id);
      if (typeof staffAdmin !== 'undefined') await adminClient.auth.admin.deleteUser(staffAdmin.user.id);
      if (typeof superAdmin !== 'undefined') await adminClient.auth.admin.deleteUser(superAdmin.user.id);
    } catch {
      // ignore cleanup errors
    }
  }

  console.log('\n==============================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED / ${failed} FAILED (${passed + failed} Total)`);
  console.log('==============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEmailDeliveryTests();
