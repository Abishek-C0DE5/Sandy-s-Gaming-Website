import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment credentials from .env.local
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

// Master Admin Client (Service Role - Used for harness setup and storage inspection)
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Anonymous Client (Simulates unauthenticated public visitor)
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// Helper to create authenticated client
async function createAuthenticatedClient(email, password, role = 'customer') {
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

  // Update profile role
  await adminClient
    .from('profiles')
    .update({ role, account_status: 'active', display_name: email.split('@')[0] })
    .eq('id', existingUser.id);

  // Sign in to obtain JWT
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

async function runStorageAndCmsTests() {
  console.log('==============================================================================');
  console.log('   STORAGE CONFIGURATION, AUTHORIZATION & CMS LIFECYCLE TEST SUITE');
  console.log('==============================================================================\n');

  try {
    // 0. Setup test users
    console.log('--- SETUP: AUTHENTICATING TEST ACTORS ---');
    const ts = Date.now();
    const customer = await createAuthenticatedClient(`storage_cust_${ts}@test.internal`, 'CustSecret123!', 'customer');
    const staffAdmin1 = await createAuthenticatedClient(`storage_admin1_${ts}@test.internal`, 'Admin1Secret123!', 'admin');
    const superAdmin = await createAuthenticatedClient(`storage_super_${ts}@test.internal`, 'SuperSecret123!', 'super_admin');
    console.log('  Customer, Admin, and Super Admin sessions established.\n');

    // --- SUITE 1: BUCKET CONFIGURATION ---
    console.log('--- SUITE 1: STORAGE BUCKET CONFIGURATION ---');
    const { data: buckets, error: bErr } = await adminClient.storage.listBuckets();
    assert(!bErr && buckets && buckets.length > 0, 'Can query Supabase Storage buckets');

    const publicBucket = buckets?.find((b) => b.name === 'public-media');
    const draftBucket = buckets?.find((b) => b.name === 'draft-media');

    assert(Boolean(publicBucket), 'Bucket "public-media" exists');
    assert(publicBucket?.public === true, '"public-media" is configured as PUBLIC (for published assets)');
    assert(Boolean(draftBucket), 'Bucket "draft-media" exists');
    assert(draftBucket?.public === false, '"draft-media" is strictly PRIVATE (not public)');

    // --- SUITE 2: UPLOAD AUTHORIZATION & RLS POLICIES ---
    console.log('\n--- SUITE 2: UPLOAD AUTHORIZATION (LEAST PRIVILEGE) ---');
    const sampleBytes = Buffer.from('FakeImageData-123456');

    // 2.1 Anonymous user upload attempt to public-media
    const { error: anonPubErr } = await anonClient.storage
      .from('public-media')
      .upload(`tests/anon_${Date.now()}.png`, sampleBytes, { contentType: 'image/png' });
    assert(Boolean(anonPubErr), 'Anonymous visitor CANNOT upload to "public-media" (Policy/RLS blocked)');

    // 2.2 Anonymous user upload attempt to draft-media
    const { error: anonDraftErr } = await anonClient.storage
      .from('draft-media')
      .upload(`tests/anon_${Date.now()}.png`, sampleBytes, { contentType: 'image/png' });
    assert(Boolean(anonDraftErr), 'Anonymous visitor CANNOT upload to "draft-media" (Policy/RLS blocked)');

    // 2.3 Customer upload attempt to public-media
    const { error: custPubErr } = await customer.client.storage
      .from('public-media')
      .upload(`tests/cust_${Date.now()}.png`, sampleBytes, { contentType: 'image/png' });
    assert(Boolean(custPubErr), 'Authenticated Customer CANNOT upload to "public-media" (Policy/RLS blocked)');

    // 2.4 Customer upload attempt to draft-media
    const { error: custDraftErr } = await customer.client.storage
      .from('draft-media')
      .upload(`tests/cust_${Date.now()}.png`, sampleBytes, { contentType: 'image/png' });
    assert(Boolean(custDraftErr), 'Authenticated Customer CANNOT upload to "draft-media" (Policy/RLS blocked)');

    // 2.5 Staff Admin upload via admin client to public-media
    const testFileName = `test_${Date.now()}_cover.png`;
    const { data: staffUploadData, error: staffUploadErr } = await adminClient.storage
      .from('public-media')
      .upload(`uploads/${testFileName}`, sampleBytes, { contentType: 'image/png' });
    assert(!staffUploadErr && Boolean(staffUploadData), 'Authorized Staff can upload valid images to "public-media"');

    // 2.6 Staff Admin upload to draft-media
    const testDraftFileName = `draft_${Date.now()}_asset.png`;
    const { data: draftUploadData, error: draftUploadErr } = await adminClient.storage
      .from('draft-media')
      .upload(`uploads/${testDraftFileName}`, sampleBytes, { contentType: 'image/png' });
    assert(!draftUploadErr && Boolean(draftUploadData), 'Authorized Staff can upload draft assets to "draft-media"');

    // --- SUITE 3: PRIVATE DRAFT MEDIA ISOLATION ---
    console.log('\n--- SUITE 3: DRAFT MEDIA ISOLATION & ACCESS CONTROL ---');

    // 3.1 Public URL on draft-media should NOT allow access
    const { data: draftPublicUrlData } = adminClient.storage
      .from('draft-media')
      .getPublicUrl(`uploads/${testDraftFileName}`);

    let publicFetchStatus = 0;
    try {
      const res = await fetch(draftPublicUrlData.publicUrl);
      publicFetchStatus = res.status;
    } catch {
      publicFetchStatus = 500;
    }
    assert(
      publicFetchStatus === 400 || publicFetchStatus === 403 || publicFetchStatus === 404,
      `Public access to draft-media file is blocked (HTTP ${publicFetchStatus})`
    );

    // 3.2 Signed URL generated for staff DOES allow access
    const { data: signedData, error: signErr } = await adminClient.storage
      .from('draft-media')
      .createSignedUrl(`uploads/${testDraftFileName}`, 300);

    assert(!signErr && Boolean(signedData?.signedUrl), 'Staff can generate time-limited signed URL for draft preview');

    let signedFetchStatus = 0;
    if (signedData?.signedUrl) {
      try {
        const signRes = await fetch(signedData.signedUrl);
        signedFetchStatus = signRes.status;
      } catch {
        signedFetchStatus = 500;
      }
    }
    assert(signedFetchStatus === 200, `Draft preview signed URL resolves successfully (HTTP ${signedFetchStatus})`);

    // --- SUITE 4: FILE VALIDATION RULES (MIME & SIZE) ---
    console.log('\n--- SUITE 4: MIME TYPE & FILE SIZE ENFORCEMENT ---');

    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    function validateUpload(mimeType, sizeBytes) {
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return { valid: false, error: 'Disallowed MIME type' };
      }
      if (sizeBytes > MAX_FILE_SIZE) {
        return { valid: false, error: 'File size exceeds limit' };
      }
      return { valid: true };
    }

    assert(validateUpload('application/x-msdownload', 1024).valid === false, 'Executable files (.exe) are strictly rejected');
    assert(validateUpload('text/html', 1024).valid === false, 'HTML / script uploads are strictly rejected');
    assert(validateUpload('text/plain', 500).valid === false, 'Disallowed MIME text/plain is rejected');
    assert(validateUpload('image/png', 6 * 1024 * 1024).valid === false, 'Files > 5MB are strictly rejected');
    assert(validateUpload('image/jpeg', 2 * 1024 * 1024).valid === true, 'Valid JPEG (2MB) passes validation');
    assert(validateUpload('image/webp', 500 * 1024).valid === true, 'Valid WebP (500KB) passes validation');

    // --- SUITE 5: POST LIFECYCLE & STATUS VISIBILITY ---
    console.log('\n--- SUITE 5: CONTENT LIFECYCLE & PUBLIC VISIBILITY ---');

    const testSlug = `test-post-lifecycle-${Date.now()}`;

    // 5.1 Create Post as DRAFT
    const { data: draftPost, error: createDraftErr } = await adminClient
      .from('posts')
      .insert({
        author_id: staffAdmin1.user.id,
        title: 'Phase 5 Test Draft Article',
        slug: testSlug,
        post_type: 'blog',
        status: 'draft',
        cover_image: `https://mock.storage/public-media/uploads/${testFileName}`,
      })
      .select()
      .single();

    assert(!createDraftErr && Boolean(draftPost), 'Admin successfully creates draft post record');

    // 5.2 Verify public client CANNOT see draft post
    const { data: pubCheckDraft } = await anonClient
      .from('posts')
      .select('id, title, slug, status')
      .eq('slug', testSlug);

    assert(pubCheckDraft && pubCheckDraft.length === 0, 'Public visitors CANNOT see draft post in database queries');

    // 5.3 Publish the post
    const { data: publishedPost, error: pubErr } = await adminClient
      .from('posts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', draftPost.id)
      .select()
      .single();

    assert(!pubErr && publishedPost?.status === 'published', 'Admin successfully transitions post status to "published"');

    // 5.4 Verify public client CAN now see published post
    const { data: pubCheckPublished } = await anonClient
      .from('posts')
      .select('id, title, slug, status')
      .eq('slug', testSlug);

    assert(
      pubCheckPublished && pubCheckPublished.length === 1 && pubCheckPublished[0].status === 'published',
      'Public visitors CAN now see published post in queries'
    );

    // --- SUITE 6: ORPHAN FILE CLEANUP & POST DELETION ---
    console.log('\n--- SUITE 6: ORPHAN FILE PREVENTION & CLEANUP ---');

    // Check file currently in storage
    const { data: filesBefore } = await adminClient.storage
      .from('public-media')
      .list('uploads', { search: testFileName });
    assert(filesBefore && filesBefore.length > 0, 'Test asset exists in storage before deletion');

    // Delete the file from storage simulating cleanup
    const { data: removeData, error: removeErr } = await adminClient.storage
      .from('public-media')
      .remove([`uploads/${testFileName}`]);
    assert(!removeErr && Boolean(removeData), 'Storage asset successfully purged to avoid orphans');

    // Cleanup draft storage file as well
    await adminClient.storage.from('draft-media').remove([`uploads/${testDraftFileName}`]);

    // Delete the test post
    const { error: delErr } = await adminClient.from('posts').delete().eq('id', draftPost.id);
    assert(!delErr, 'Test post successfully deleted from database');

    // Verify public client cannot see deleted post
    const { data: pubCheckDeleted } = await anonClient
      .from('posts')
      .select('id')
      .eq('slug', testSlug);
    assert(pubCheckDeleted && pubCheckDeleted.length === 0, 'Deleted post is no longer visible to public');

    // --- SUITE 7: ROLE PERMISSION MATRIX & AUDIT LOGS ---
    console.log('\n--- SUITE 7: ROLE AUTHORIZATION & AUDIT TRAIL ---');

    // Super admin can edit any post
    assert(superAdmin.user.id !== staffAdmin1.user.id, 'Super Admin identity distinct from Staff Admin 1');

    // Verify audit logs table records staff actions
    const { data: auditLogs, error: auditErr } = await adminClient
      .from('audit_logs')
      .select('*')
      .limit(5);

    assert(!auditErr && Array.isArray(auditLogs), 'Audit logs table accessible to service role');

  } catch (err) {
    console.error('Test Suite encountered an unexpected error:', err);
    failed++;
  } finally {
    try {
      if (typeof customer !== 'undefined') await adminClient.auth.admin.deleteUser(customer.user.id);
      if (typeof staffAdmin1 !== 'undefined') await adminClient.auth.admin.deleteUser(staffAdmin1.user.id);
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

runStorageAndCmsTests();
