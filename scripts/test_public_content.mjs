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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.');
  process.exit(1);
}

// Anonymous / Public client simulating an unauthenticated external visitor
const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

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

async function runPublicContentTests() {
  console.log('==============================================================================');
  console.log('   PUBLIC CONTENT EXPERIENCE & DRAFT ISOLATION TEST SUITE');
  console.log('==============================================================================\n');

  try {
    // --- SUITE 1: PUBLISHED BLOG QUERIES ---
    console.log('--- SUITE 1: PUBLISHED CONTENT VISIBILITY ---');

    const { data: publishedBlogs, error: bErr } = await publicClient
      .from('posts')
      .select('id, title, slug, post_type, status, published_at')
      .eq('post_type', 'blog')
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false });

    assert(!bErr, 'Public visitor can execute published blog queries without SQL errors');
    assert(publishedBlogs && publishedBlogs.length >= 3, `Public visitor receives published blogs (Found: ${publishedBlogs?.length})`);
    
    const allPublished = publishedBlogs?.every((b) => b.status === 'published');
    assert(allPublished === true, 'All returned blogs have strictly status = "published"');

    // --- SUITE 2: DRAFT & CONFIDENTIAL CONTENT LEAK PREVENTION ---
    console.log('\n--- SUITE 2: DRAFT LEAK PREVENTION & ISOLATION ---');

    // Attempt direct lookup of draft blog by slug
    const draftSlug = 'internal-draft-confidential-upcoming-product-lineup';
    const { data: draftBySlug } = await publicClient
      .from('posts')
      .select('*')
      .eq('slug', draftSlug);

    assert(draftBySlug && draftBySlug.length === 0, 'Direct slug query for draft post returns 0 rows (not leaked)');

    // Attempt direct query for draft post by status filter
    const { data: draftList } = await publicClient
      .from('posts')
      .select('*')
      .eq('status', 'draft');

    assert(draftList && draftList.length === 0, 'Query for status = "draft" returns 0 rows to public visitor');

    // Attempt query of draft media
    const draftPosterSlug = 'confidential-draft-prototype-poster-concept';
    const { data: draftPoster } = await publicClient
      .from('posts')
      .select('*')
      .eq('slug', draftPosterSlug);

    assert(draftPoster && draftPoster.length === 0, 'Query for draft poster returns 0 rows');

    const { data: draftMedia } = await publicClient
      .from('post_media')
      .select('*')
      .ilike('alt_text', '%prototype%');

    assert(draftMedia && draftMedia.length === 0, 'Draft media assets are completely invisible to public visitor');

    // --- SUITE 3: GALLERY & MEDIA ATTACHMENT RESOLUTION ---
    console.log('\n--- SUITE 3: POSTER & PHOTO GALLERY RESOLUTION ---');

    const { data: galleryItems, error: gErr } = await publicClient
      .from('posts')
      .select('id, title, slug, post_type, status')
      .in('post_type', ['poster', 'photo'])
      .eq('status', 'published');

    assert(!gErr, 'Public visitor can query published gallery items');
    assert(galleryItems && galleryItems.length >= 2, `Published posters and photos returned (Found: ${galleryItems?.length})`);

    // Verify post_media resolution for published post
    const samplePoster = galleryItems?.find((i) => i.post_type === 'poster');
    if (samplePoster) {
      const { data: media, error: mErr } = await publicClient
        .from('post_media')
        .select('*')
        .eq('post_id', samplePoster.id);

      assert(!mErr && media && media.length > 0, 'Public visitor can retrieve post_media metadata for published poster');
      assert(media && Boolean(media[0]?.storage_path), 'Media record contains valid storage path');
      assert(media && Boolean(media[0]?.alt_text), 'Media record contains descriptive accessible alt text');
    }

    // --- SUITE 4: SLUG VALIDATION & NOT-FOUND BEHAVIOR ---
    console.log('\n--- SUITE 4: SLUG VALIDATION & BOUNDED PAGINATION ---');

    // Non-existent slug
    const fakeSlug = 'non-existent-article-slug-xyz-999';
    const { data: fakePost } = await publicClient
      .from('posts')
      .select('*')
      .eq('slug', fakeSlug)
      .maybeSingle();

    assert(fakePost === null, 'Non-existent slug lookup safely resolves to null (triggering notFound())');

    // Bounded query limit test
    const { data: boundedPosts, count: totalPosts } = await publicClient
      .from('posts')
      .select('id, title', { count: 'exact' })
      .eq('status', 'published')
      .range(0, 1);

    assert(boundedPosts && boundedPosts.length <= 2, `Bounded range query strictly limits result set size (returned ${boundedPosts?.length} rows)`);
    assert(typeof totalPosts === 'number' && totalPosts >= 2, `Exact count retrieved for pagination computation (Total: ${totalPosts})`);

  } catch (err) {
    console.error('Test Suite encountered an unexpected error:', err);
    failed++;
  }

  console.log('\n==============================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED / ${failed} FAILED (${passed + failed} Total)`);
  console.log('==============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPublicContentTests();
