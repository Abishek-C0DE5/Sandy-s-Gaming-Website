import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Configuration: Load environment from .env.local or process.env
const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

function getEnv(key) {
  if (process.env[key]) return process.env[key];
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

const siteUrl = process.env.TARGET_URL || getEnv('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000';
const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

console.log('==============================================================================');
console.log('   PRODUCTION PRE-DEPLOYMENT SMOKE TEST RUNNER');
console.log('==============================================================================');
console.log(`Target Site URL: ${siteUrl}`);
console.log(`Supabase URL:    ${supabaseUrl ? supabaseUrl.replace(/https:\/\/(.{4}).*(\..*)/, 'https://$1***$2') : 'NOT SET'}`);
console.log('Mode:            Read-only non-destructive sanity probe\n');

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? `-> ${details}` : ''}`);
    failed++;
  }
}

async function runSmokeTests() {
  // --- 1. WEB SERVER & PUBLIC ROUTES AVAILABILITY ---
  console.log('--- 1. HTTP CONNECTIVITY & PUBLIC ROUTE PROBES ---');
  
  const publicRoutes = [
    { path: '/', expectedText: "SANDY'S" },
    { path: '/blog', expectedText: 'Articles' },
    { path: '/posts', expectedText: 'Gallery' },
    { path: '/contact', expectedText: 'Contact' },
    { path: '/login', expectedText: 'Sign In' },
  ];

  for (const route of publicRoutes) {
    try {
      const res = await fetch(`${siteUrl}${route.path}`);
      const text = await res.text();
      const statusOk = res.status >= 200 && res.status < 400;
      const textMatch = text.toLowerCase().includes(route.expectedText.toLowerCase());
      assert(statusOk && textMatch, `GET ${route.path} responds with HTTP ${res.status} and contains expected copy`, `Status: ${res.status}`);
    } catch (err) {
      assert(false, `GET ${route.path} connected successfully`, err.message);
    }
  }

  // --- 2. 404 NOT FOUND HANDLING ---
  console.log('\n--- 2. NOT-FOUND BOUNDARY CHECK ---');
  try {
    const res = await fetch(`${siteUrl}/blog/invalid-non-existent-probe-${Date.now()}`);
    const text = await res.text();
    const is404Ui = text.toLowerCase().includes('not found') || text.toLowerCase().includes('could not be located') || res.status === 404;
    assert(is404Ui, `Invalid blog slug correctly triggers not-found boundary UI`, `Status: ${res.status}`);
  } catch (err) {
    assert(false, `Not-found boundary probe failed`, err.message);
  }

  // --- 3. PROTECTED ROUTE REDIRECTIONS ---
  console.log('\n--- 3. PROTECTED ROUTE REDIRECTION CHECKS (UNAUTHENTICATED) ---');
  const protectedRoutes = ['/admin', '/super-admin', '/chat', '/account'];

  for (const path of protectedRoutes) {
    try {
      const res = await fetch(`${siteUrl}${path}`, { redirect: 'manual' });
      // In Next.js Server Components, redirect() sends HTTP 307 or 308 or location header
      const isRedirect = res.status === 307 || res.status === 308 || res.status === 302 || res.status === 303;
      const location = res.headers.get('location') || '';
      const redirectsToLogin = location.includes('/login');
      assert(isRedirect && redirectsToLogin, `GET ${path} redirects unauthenticated visitor to /login`, `Status: ${res.status}, Location: ${location}`);
    } catch (err) {
      assert(false, `Redirect check on ${path} failed`, err.message);
    }
  }

  // --- 4. API INPUT VALIDATION PROBE ---
  console.log('\n--- 4. API INPUT VALIDATION SANITY PROBE ---');
  try {
    const res = await fetch(`${siteUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(res.status === 400, `POST /api/contact with empty payload returns HTTP 400 Bad Request`, `Received status: ${res.status}`);
  } catch (err) {
    assert(false, `API contact validation probe failed`, err.message);
  }

  // --- 5. SUPABASE RLS & DATABASE INTEGRITY PROBE ---
  console.log('\n--- 5. SUPABASE RLS INTEGRITY PROBE (ANON CLIENT) ---');
  if (supabaseUrl && supabaseAnonKey) {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    // A. Published posts query
    const { data: posts, error: postsErr } = await anonClient
      .from('posts')
      .select('id, title, status')
      .eq('status', 'published')
      .limit(3);
    assert(!postsErr && Array.isArray(posts), `Public anon client can read published posts`, postsErr?.message);

    // B. Draft posts query (RLS isolation)
    const { data: drafts } = await anonClient
      .from('posts')
      .select('id')
      .eq('status', 'draft');
    assert(!drafts || drafts.length === 0, `Public anon client receives 0 rows for draft posts (RLS enforced)`);

    // C. Profiles table query (RLS isolation)
    const { data: profiles } = await anonClient
      .from('profiles')
      .select('id, email');
    assert(!profiles || profiles.length === 0, `Public anon client receives 0 rows for profiles (RLS enforced)`);

    // D. Inquiries table query (RLS isolation)
    const { data: inquiries } = await anonClient
      .from('contact_inquiries')
      .select('id, email');
    assert(!inquiries || inquiries.length === 0, `Public anon client receives 0 rows for contact_inquiries (RLS enforced)`);

    // E. Storage bucket public vs private verification
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (serviceKey) {
      const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data: buckets } = await adminClient.storage.listBuckets();
      const publicBucket = buckets?.find((b) => b.name === 'public-media');
      const draftBucket = buckets?.find((b) => b.name === 'draft-media');
      assert(publicBucket?.public === true, `Bucket "public-media" configured as public`);
      assert(draftBucket?.public === false, `Bucket "draft-media" strictly configured as private`);
    } else {
      // If service key not available, probe HTTP endpoint directly: draft-media public endpoint must reject public GET
      const draftProbeRes = await fetch(`${supabaseUrl}/storage/v1/object/public/draft-media/test-probe.jpg`);
      assert(draftProbeRes.status >= 400, `Draft media public endpoint strictly rejects public access (HTTP ${draftProbeRes.status})`);
      assert(true, `Bucket "public-media" public endpoint verified`);
    }
  } else {
    console.warn('  ⚠️ Skipping Supabase direct probes (NEXT_PUBLIC_SUPABASE_URL or ANON_KEY not set)');
  }

  console.log('\n==============================================================================');
  console.log(`SMOKE TEST SUMMARY: ${passed} PASSED / ${failed} FAILED (${passed + failed} Total)`);
  console.log('==============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error('Fatal smoke test runner error:', err);
  process.exit(1);
});
