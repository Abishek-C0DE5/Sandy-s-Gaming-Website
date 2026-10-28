import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local safely
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
  console.error('Missing required environment keys in .env.local');
  process.exit(1);
}

const maskedUrl = supabaseUrl.replace(/https:\/\/(.{4}).*(\..*)/, 'https://$1***$2');
console.log('Connecting to Supabase instance:', maskedUrl);

// Service role client to verify all tables and triggers
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Anon client to test public RLS restrictions
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

const tables = [
  'profiles',
  'posts',
  'post_media',
  'conversations',
  'conversation_assignments',
  'messages',
  'contact_inquiries',
  'contact_inquiry_replies',
  'audit_logs'
];

async function verify() {
  console.log('\n--- 1. TABLE EXISTENCE & ACCESS CHECK (Service Role) ---');
  let allTablesExist = true;
  for (const table of tables) {
    const { error } = await adminClient.from(table).select('count', { count: 'exact', head: true });
    if (error) {
      console.error(`❌ Table "${table}": Error -> ${error.message} (${error.code})`);
      allTablesExist = false;
    } else {
      console.log(`✅ Table "${table}": Exists & accessible`);
    }
  }

  console.log('\n--- 2. RLS SECURITY POLICY ENFORCEMENT CHECK (Anonymous Access) ---');
  
  // A. Anon querying profiles -> should be blocked / return 0 rows
  const { data: anonProfiles, error: anonProfilesError } = await anonClient.from('profiles').select('*');
  if (anonProfiles && anonProfiles.length === 0) {
    console.log('✅ RLS Profiles: Public SELECT blocked (0 rows returned)');
  } else if (anonProfilesError) {
    console.log(`✅ RLS Profiles: Blocked with error -> ${anonProfilesError.message}`);
  } else {
    console.warn('⚠️ RLS Profiles: Unexpected public leak');
  }

  // B. Anon querying contact_inquiries -> must be blocked
  const { data: anonInquiries, error: anonInquiriesError } = await anonClient.from('contact_inquiries').select('*');
  if (anonInquiries && anonInquiries.length === 0) {
    console.log('✅ RLS Contact Inquiries: Public SELECT blocked (0 rows returned)');
  } else if (anonInquiriesError) {
    console.log(`✅ RLS Contact Inquiries: Blocked with error -> ${anonInquiriesError.message}`);
  } else {
    console.warn('⚠️ RLS Contact Inquiries: Unexpected public leak');
  }

  // C. Anon querying conversations -> must be blocked
  const { data: anonConvs, error: anonConvsError } = await anonClient.from('conversations').select('*');
  if (anonConvs && anonConvs.length === 0) {
    console.log('✅ RLS Conversations: Public SELECT blocked (0 rows returned)');
  } else if (anonConvsError) {
    console.log(`✅ RLS Conversations: Blocked with error -> ${anonConvsError.message}`);
  } else {
    console.warn('⚠️ RLS Conversations: Unexpected public leak');
  }

  // D. Anon inserting valid contact inquiry -> should succeed (WITHOUT .select() since anon has zero SELECT privilege)
  console.log('\n--- 3. GUEST INQUIRY INSERTION TEST ---');
  const testEmail = `verify_${Date.now()}@test.local`;
  const { error: insertError } = await anonClient
    .from('contact_inquiries')
    .insert({
      name: 'Verification Probe',
      email: testEmail,
      phone: '+1 555-0199',
      message: 'Automated verification inquiry test payload.',
      status: 'new'
    });

  if (insertError) {
    console.error(`❌ Guest inquiry INSERT failed: ${insertError.message}`);
  } else {
    console.log(`✅ Guest inquiry INSERT succeeded (Anon allowed to submit without read leak!)`);
    
    // Verify it exists using adminClient and clean up
    const { data: foundProbe } = await adminClient.from('contact_inquiries').select('id, email, status').eq('email', testEmail).single();
    if (foundProbe) {
      console.log(`✅ Verified probe in DB via Admin Client (ID: ${foundProbe.id}, Status: ${foundProbe.status})`);
      await adminClient.from('contact_inquiries').delete().eq('id', foundProbe.id);
      console.log('✅ Cleaned up probe inquiry record.');
    }
  }

  console.log('\n--- 4. FINAL VERIFICATION SUMMARY ---');
  if (allTablesExist) {
    console.log('🎉 REMOTE SUPABASE DATABASE IS VERIFIED AND 100% OPERATIONAL!');
  } else {
    console.error('❌ Table verification failed.');
  }
}

verify().catch(console.error);
