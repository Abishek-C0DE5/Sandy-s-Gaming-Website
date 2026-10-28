import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Required environment variables missing in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function seedContent() {
  console.log('--- SEEDING REAL DATABASE CONTENT FOR PUBLIC EXPERIENCE ---');

  // 1. Provision a staff author account
  const authorEmail = 'editorial@apexpublish.local';
  let authorId;

  const { data: existingUser } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', authorEmail)
    .maybeSingle();

  if (existingUser) {
    authorId = existingUser.id;
  } else {
    const { data: newAuth, error: authErr } = await adminClient.auth.admin.createUser({
      email: authorEmail,
      email_confirm: true,
      user_metadata: { display_name: 'Apex Editorial Team' },
    });
    if (authErr) throw authErr;
    authorId = newAuth.user.id;
    await adminClient.from('profiles').update({ role: 'admin', display_name: 'Apex Editorial Team' }).eq('id', authorId);
  }

  console.log(`Staff Author ID: ${authorId}`);

  // 2. Define Sample Published and Draft Posts
  const samplePosts = [
    {
      title: 'Architecting High-Throughput Modern Web Applications',
      slug: 'architecting-high-throughput-modern-web-applications',
      post_type: 'blog',
      status: 'published',
      excerpt: 'Explore how combining Next.js 16 App Router, PostgreSQL Row Level Security, and edge routing creates blazing-fast, secure user experiences.',
      body: `## The Modern Web Paradigm

Building enterprise-grade applications in 2026 requires balancing client responsiveness with uncompromising backend authorization. By offloading stateful data security to PostgreSQL Row Level Security (RLS), application servers remain lightweight while ensuring strict customer data isolation.

### Key Architectural Pillars

1. **Least-Privilege Database Grants:** Every role (anonymous, authenticated customer, specialist admin, super admin) receives precisely the SQL operations they are permitted to perform.
2. **Deterministic Role Resolution:** Server components query database profiles directly to resolve authority, eliminating the threat of stale or forged JWT metadata claims.
3. **Resilient Real-Time Event Streams:** Supabase Realtime delivers instantaneous bi-directional communication across support specialists and clients without polling overhead.

\`\`\`typescript
// Server-side authorization verification
const profile = await requireRole(['admin', 'super_admin'], '/admin');
\`\`\`

### Looking Forward

As applications scale, separating guest inquiry ingestion from persistent authenticated communication pipelines prevents resource contention and protects internal operational identity.`,
      cover_image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
      published_at: new Date(Date.now() - 3600 * 1000 * 24 * 3).toISOString(), // 3 days ago
      author_id: authorId,
    },
    {
      title: 'The Art of Shared Multi-Admin Support Pipelines',
      slug: 'the-art-of-shared-multi-admin-support-pipelines',
      post_type: 'blog',
      status: 'published',
      excerpt: 'Why traditional single-agent helpdesks fail modern customer expectations and how shared multi-admin queues solve coverage bottlenecks.',
      body: `## The Evolution of Customer Support

Traditional customer support platforms frequently lock tickets to individual agents. When an agent steps away, breaks for lunch, or rotates shifts, customer threads stall.

### The Unified Team Persona

In our shared conversation model:
- Customers communicate with a cohesive **"Support Team"** persona.
- Behind the scenes, multiple assigned specialists can join, review historical context, and respond collaboratively.
- True administrative attribution is preserved in PostgreSQL audit records while presenting a smooth, branded facade to the customer.

> "A customer should never have to repeat their issue merely because a different specialist picked up the thread."

### Real-Time Coordination

Using database triggers and PostgreSQL publication channels, every assigned specialist sees incoming messages instantly without race conditions or collision bugs.`,
      cover_image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80',
      published_at: new Date(Date.now() - 3600 * 1000 * 24 * 1).toISOString(), // 1 day ago
      author_id: authorId,
    },
    {
      title: 'Designing for Strict Accessibility and Performance in 2026',
      slug: 'designing-for-strict-accessibility-and-performance',
      post_type: 'blog',
      status: 'published',
      excerpt: 'A comprehensive checklist for accessible form controls, keyboard navigation traps, ARIA compliance, and minimal layout shift.',
      body: `## Accessibility is Not an Add-On

Building accessible interfaces ensures every visitor—regardless of motor ability, vision, or assistive device—can navigate and engage with digital content seamlessly.

### Core Accessibility Principles Implemented

- **Proper Landmark Hierarchy:** A single primary \`h1\` per page with strictly ordered heading descendants.
- **Keyboard Navigation & Traps:** Interactive dialogs trap tab navigation while open and release cleanly upon \`Escape\`.
- **Visible Focus Indicators:** High-contrast focus rings ensure keyboard-only users always know the active control.
- **Descriptive Alt Text:** Every visual asset includes contextual alternative descriptions rather than empty placeholders.`,
      cover_image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80',
      published_at: new Date().toISOString(),
      author_id: authorId,
    },
    {
      title: 'Neon Cyberpunk Metropolis Poster',
      slug: 'neon-cyberpunk-metropolis-poster',
      post_type: 'poster',
      status: 'published',
      excerpt: 'A striking high-contrast typographic poster capturing urban neon reflections in a futuristic skyline.',
      body: 'Created as part of the 2026 Creative Design Series. Features deep obsidian shadows accented by vibrant cyan and magenta luminescence.',
      cover_image: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=80',
      published_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
      author_id: authorId,
    },
    {
      title: 'Minimalist Monolithic Architecture Photography',
      slug: 'minimalist-monolithic-architecture-photography',
      post_type: 'photo',
      status: 'published',
      excerpt: 'Brutalist concrete geometries juxtaposed with morning mist and soft ambient sunlight.',
      body: 'Shot on 35mm format in Copenhagen. Focuses on spatial symmetry, tactile textures, and architectural grandeur.',
      cover_image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
      published_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
      author_id: authorId,
    },
    {
      title: 'INTERNAL DRAFT: Confidential Upcoming Product Lineup',
      slug: 'internal-draft-confidential-upcoming-product-lineup',
      post_type: 'blog',
      status: 'draft',
      excerpt: 'THIS IS A STRICT DRAFT: Under no circumstances should this be visible to public or customer visitors.',
      body: 'Secret roadmap details and unannounced feature specs.',
      cover_image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      published_at: null,
      author_id: authorId,
    },
    {
      title: 'CONFIDENTIAL DRAFT: Prototype Poster Concept',
      slug: 'confidential-draft-prototype-poster-concept',
      post_type: 'poster',
      status: 'draft',
      excerpt: 'Unreleased graphic design prototype draft.',
      body: 'Internal iteration only.',
      cover_image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
      published_at: null,
      author_id: authorId,
    },
  ];

  for (const post of samplePosts) {
    const { data: existing } = await adminClient
      .from('posts')
      .select('id')
      .eq('slug', post.slug)
      .maybeSingle();

    if (!existing) {
      const { data: created, error } = await adminClient.from('posts').insert(post).select().single();
      if (error) {
        console.error(`Failed to seed post "${post.title}":`, error.message);
      } else {
        console.log(`✅ Seeded post: "${post.title}" (${post.post_type}, ${post.status})`);

        // If poster or photo, attach normalized post_media
        if (post.post_type === 'poster' || post.post_type === 'photo') {
          await adminClient.from('post_media').insert({
            post_id: created.id,
            storage_path: post.cover_image,
            media_type: 'image/jpeg',
            alt_text: `High-resolution photograph for ${post.title}`,
            sort_order: 1,
          });
        }
      }
    } else {
      console.log(`ℹ️ Post "${post.title}" already exists.`);
    }
  }

  console.log('Seeding completed successfully!');
}

seedContent().catch(console.error);
