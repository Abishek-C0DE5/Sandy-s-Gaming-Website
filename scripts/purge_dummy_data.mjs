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

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRESERVED_EMAILS = [
  'superadmin.sandysgaming@gmail.com',
  'admin.sandysgaming@gmail.com',
  'visitor.sandysgaming@gmail.com',
];

async function purgeDummyData() {
  console.log('=== STARTING COMPLETE DUMMY DATA PURGE ===');

  // 1. Purge test accounts from auth.users
  const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    console.error('Error listing users:', listError);
  } else {
    const allUsers = usersData?.users || [];
    console.log(`Total users found: ${allUsers.length}`);

    let deletedCount = 0;
    for (const user of allUsers) {
      const email = user.email || '';
      if (!PRESERVED_EMAILS.includes(email.toLowerCase())) {
        console.log(`Deleting dummy test user: ${email} (${user.id})`);
        const { error: delError } = await adminClient.auth.admin.deleteUser(user.id);
        if (delError) {
          console.warn(`Failed to delete user ${email}:`, delError.message);
        } else {
          deletedCount++;
        }
      }
    }
    console.log(`✅ Successfully deleted ${deletedCount} dummy test accounts!`);
  }

  // 2. Ensure profiles for preserved accounts are intact with correct roles and display names
  console.log('\n--- Verifying Official Accounts ---');
  const { data: adminUser } = await adminClient
    .from('profiles')
    .select('id, email, role, display_name')
    .eq('email', 'admin.sandysgaming@gmail.com')
    .single();

  const { data: visitorUser } = await adminClient
    .from('profiles')
    .select('id, email, role, display_name')
    .eq('email', 'visitor.sandysgaming@gmail.com')
    .single();

  const { data: superAdminUser } = await adminClient
    .from('profiles')
    .select('id, email, role, display_name')
    .eq('email', 'superadmin.sandysgaming@gmail.com')
    .single();

  console.log('Official Admin Profile:', adminUser);
  console.log('Official Visitor Profile:', visitorUser);
  console.log('Official Super Admin Profile:', superAdminUser);

  // 3. Clear existing generic dummy posts and seed official Sandy\'s Gaming content
  console.log('\n--- Replacing Generic Dummy Posts with Authentic Sandy\'s Gaming Content ---');
  await adminClient.from('post_media').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await adminClient.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const authorId = adminUser ? adminUser.id : superAdminUser?.id;

  const realGamingPosts = [
    {
      author_id: authorId,
      title: "Welcome to Sandy's Gaming Official Arena & Community Hub",
      slug: 'welcome-to-sandys-gaming-official-hub',
      excerpt: "Step into the definitive competitive arena. Unrivaled gaming tournaments, verified esports coverage, and authentic community culture.",
      body: `## The Next Evolution of Competitive Gaming

Welcome to **Sandy's Gaming** — the premier destination built from the ground up for competitive gamers, tournament warriors, and esports enthusiasts.

### What We Offer

1. **Active Tournament Brackets:** Compete against the best talent across leading FPS, battle royale, and fighting titles.
2. **24/7 Live Support Team:** Have questions about tournament schedules, match disputes, or account privileges? Our live chat support team is standing by around the clock.
3. **Curated Esports Intel:** In-depth tactical guides, meta tier lists, and verified tournament recaps published directly by our editorial specialists.

> "Victory belongs to the prepared. Step onto the battlefield with Sandy's Gaming."

Join our official chat or submit an inquiry to learn more about upcoming open qualifiers!`,
      post_type: 'blog',
      status: 'published',
      cover_image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
      published_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      author_id: authorId,
      title: "24/7 Dedicated Live Support Chat Is Officially Live",
      slug: 'live-support-chat-officially-live',
      excerpt: "Registered members can now initiate real-time support sessions directly with our staff specialists with zero page reloads.",
      body: `## Instant, Real-Time Gamer Support

We are excited to launch our upgraded **Real-Time Live Chat System** for all registered members of Sandy's Gaming.

### How It Works

- **Persistent Private Threads:** Every registered visitor gets their own dedicated conversation thread with the Sandy's Gaming Support Team.
- **Instant Messaging:** Powered by PostgreSQL real-time streaming, your messages and staff replies appear instantaneously without manual page refreshes.
- **Privacy First:** Staff members converse under our unified "Support Team" banner, ensuring a consistent, secure, and professional support experience.

Log in and head to the **Live Chat** tab in the navigation bar to start chatting with us today!`,
      post_type: 'blog',
      status: 'published',
      cover_image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
      published_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      author_id: authorId,
      title: "Upcoming Sandy's Competitive Tournament Series 2026",
      slug: 'upcoming-sandys-competitive-tournament-2026',
      excerpt: "Prize pools, registration guidelines, and qualification rules for our upcoming regional esports championship.",
      body: `## Register for the 2026 Championship Series

Registration is officially opening for the **Sandy's Gaming 2026 Championship Series**. With verified prizes, broadcasted grand finals, and certified anti-cheat standards, this is your team's opportunity to prove their dominance.

### Key Tournament Dates

- **Open Qualifiers:** November 15, 2026
- **Group Stages:** November 22, 2026
- **Championship Grand Finals:** December 5, 2026

### Registration Requirements

All participants must be registered members on Sandy's Gaming. For bracket inquiries or roster substitutions, open a Live Chat session with the Support Team.`,
      post_type: 'blog',
      status: 'published',
      cover_image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80',
      published_at: new Date().toISOString(),
    },
  ];

  for (const post of realGamingPosts) {
    const { data: inserted, error: insertError } = await adminClient
      .from('posts')
      .insert(post)
      .select('id, title, slug, status')
      .single();

    if (insertError) {
      console.error(`Error inserting post "${post.title}":`, insertError.message);
    } else {
      console.log(`✅ Seeded authentic post: "${inserted.title}" (${inserted.slug})`);
    }
  }

  // 4. Clean up any dummy contact inquiries
  console.log('\n--- Cleaning Up Test Contact Inquiries ---');
  const { data: testInquiries } = await adminClient
    .from('contact_inquiries')
    .select('id, email');

  let delInqCount = 0;
  for (const inq of testInquiries || []) {
    if (inq.email.includes('verify_') || inq.email.includes('test') || inq.email.includes('probe')) {
      await adminClient.from('contact_inquiries').delete().eq('id', inq.id);
      delInqCount++;
    }
  }
  console.log(`✅ Deleted ${delInqCount} test inquiries.`);

  // 5. Clean up old test conversations/messages
  console.log('\n--- Cleaning Up Old Test Conversations ---');
  const { data: allConvs } = await adminClient.from('conversations').select('id, customer_id');
  for (const conv of allConvs || []) {
    // If conversation is from an old deleted customer or admin, delete it
    if (conv.customer_id !== visitorUser?.id) {
      await adminClient.from('conversations').delete().eq('id', conv.id);
      console.log(`Deleted orphan/test conversation: ${conv.id}`);
    }
  }

  // 6. Ensure the official visitor has their persistent conversation assigned to admin
  if (visitorUser && adminUser) {
    console.log('\n--- Setting up Official Visitor Persistent Conversation ---');
    let { data: officialConv } = await adminClient
      .from('conversations')
      .select('id')
      .eq('customer_id', visitorUser.id)
      .maybeSingle();

    if (!officialConv) {
      const { data: newConv } = await adminClient
        .from('conversations')
        .insert({
          customer_id: visitorUser.id,
          subject: "Sandy's Gaming Support Chat",
          status: 'open',
        })
        .select()
        .single();
      officialConv = newConv;
      console.log('Created fresh official conversation for visitor:', officialConv?.id);
    }

    if (officialConv?.id) {
      // Assign admin
      await adminClient.from('conversation_assignments').upsert(
        {
          conversation_id: officialConv.id,
          admin_id: adminUser.id,
          status: 'active',
        },
        { onConflict: 'conversation_id,admin_id' }
      );
      console.log(`✅ Official conversation ${officialConv.id} actively assigned to Admin ${adminUser.id}`);
    }
  }

  console.log('\n=== DUMMY DATA PURGE COMPLETE! ===');
}

purgeDummyData().catch(console.error);
