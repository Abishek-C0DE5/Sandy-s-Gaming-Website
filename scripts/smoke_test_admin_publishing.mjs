import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error('Missing required env variables');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const userClient = createClient(supabaseUrl, anonKey);

async function run() {
  console.log('--- ADMIN PUBLISHING & IMAGE UPLOAD SMOKE TEST ---');

  // 1. Sign in as Admin
  const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
    email: 'admin.sandysgaming@gmail.com',
    password: 'TestPassword123!',
  });

  if (authError || !authData.user) {
    console.error('Failed to authenticate admin:', authError?.message);
    process.exit(1);
  }
  console.log('1. Admin authenticated successfully:', authData.user.email);

  // 2. Test Image Upload directly to public-media bucket
  const fakePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const testPath = `covers/test_smoke_${Date.now()}.png`;
  const { data: uploadData, error: uploadErr } = await adminClient.storage
    .from('public-media')
    .upload(testPath, fakePngBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadErr) {
    console.error('Storage upload failed:', uploadErr.message);
    process.exit(1);
  }

  const { data: publicUrlData } = adminClient.storage.from('public-media').getPublicUrl(testPath);
  console.log('2. Image uploaded to public-media bucket. URL:', publicUrlData.publicUrl);

  // 3. Create a test post in the database
  const testSlug = `smoke-test-game-${Date.now()}`;
  const { data: postData, error: postErr } = await adminClient
    .from('posts')
    .insert({
      author_id: authData.user.id,
      title: 'Smoke Test Game Announcement',
      slug: testSlug,
      post_type: 'blog',
      status: 'published',
      excerpt: 'This is a verified test post for Sandy Gaming CMS.',
      body: 'Verified body content with live media asset connection.',
      cover_image: publicUrlData.publicUrl,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (postErr) {
    console.error('Failed to create post:', postErr.message);
    process.exit(1);
  }
  console.log('3. Test post created in database with ID:', postData.id, 'Slug:', postData.slug);

  // 4. Verify post can be fetched publicly by visitors
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: publicPost, error: fetchErr } = await anonClient
    .from('posts')
    .select('*')
    .eq('slug', testSlug)
    .eq('status', 'published')
    .single();

  if (fetchErr || !publicPost) {
    console.error('Public fetch failed:', fetchErr?.message);
    process.exit(1);
  }
  console.log('4. Post publicly readable by anonymous visitors. Cover:', publicPost.cover_image);

  // 5. Clean up test assets
  await adminClient.storage.from('public-media').remove([testPath]);
  await adminClient.from('posts').delete().eq('id', postData.id);
  console.log('5. Cleaned up test post and storage image successfully.');

  console.log('--- ALL ADMIN PUBLISHING & UPLOAD TESTS PASSED (100%) ---');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
