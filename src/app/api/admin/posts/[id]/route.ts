import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updatePostSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  post_type: z.enum(['blog', 'poster', 'photo']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  excerpt: z.string().trim().max(500).optional().nullable(),
  body: z.string().optional().nullable(),
  cover_image: z.string().url('Invalid URL').optional().nullable(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to extract storage path from full URL
function extractStoragePath(url: string | null): { bucket: string; path: string } | null {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (match) {
    return { bucket: match[1], path: decodeURIComponent(match[2].split('?')[0]) };
  }
  return null;
}

// GET /api/admin/posts/[id] - Retrieve single post with media for editing
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminClient = await createAdminClient();
  const { data: post, error } = await adminClient
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const { data: media } = await adminClient
    .from('post_media')
    .select('*')
    .eq('post_id', id)
    .order('sort_order', { ascending: true });

  return NextResponse.json({ post, media: media || [] });
}

// PATCH /api/admin/posts/[id] - Update post content, status, and media
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminClient = await createAdminClient();

  // Verify post existence and author permission (Admin can only edit own, Super Admin can edit all)
  const { data: existingPost } = await adminClient
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (!existingPost) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  if (profile.role === 'admin' && existingPost.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden: You can only edit posts you authored' }, { status: 403 });
  }

  const json = await request.json();
  const parsed = updatePostSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updates: import('@/types/database').Database['public']['Tables']['posts']['Update'] = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  // If status transitioning to published and published_at not set, set it now
  if (updates.status === 'published' && !existingPost.published_at) {
    updates.published_at = new Date().toISOString();
  }

  // Handle file replacement: if cover_image was changed, remove old file from Storage to avoid orphans
  if (updates.cover_image && existingPost.cover_image && updates.cover_image !== existingPost.cover_image) {
    const oldStorage = extractStoragePath(existingPost.cover_image);
    if (oldStorage) {
      await adminClient.storage.from(oldStorage.bucket).remove([oldStorage.path]);
    }
  }

  const { data: updatedPost, error: updateError } = await adminClient
    .from('posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Audit log
  await adminClient.from('audit_logs').insert({
    actor_id: user.id,
    action: 'POST_UPDATED',
    target_type: 'post',
    target_id: id,
    metadata: { updates },
  });

  return NextResponse.json({ success: true, post: updatedPost });
}

// DELETE /api/admin/posts/[id] - Delete post and clean up associated storage assets
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminClient = await createAdminClient();

  const { data: existingPost } = await adminClient
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (!existingPost) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  if (profile.role === 'admin' && existingPost.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden: You can only delete posts you authored' }, { status: 403 });
  }

  // 1. Collect all media files to purge from storage
  const filesToPurge: { bucket: string; path: string }[] = [];

  const coverStorage = extractStoragePath(existingPost.cover_image);
  if (coverStorage) filesToPurge.push(coverStorage);

  const { data: mediaItems } = await adminClient
    .from('post_media')
    .select('storage_path')
    .eq('post_id', id);

  if (mediaItems) {
    for (const item of mediaItems) {
      const parsed = extractStoragePath(item.storage_path);
      if (parsed) filesToPurge.push(parsed);
      else if (item.storage_path.includes('/')) {
        // Direct path
        filesToPurge.push({ bucket: 'public-media', path: item.storage_path });
      }
    }
  }

  // 2. Delete database record (Cascade deletes post_media)
  const { error: deleteError } = await adminClient
    .from('posts')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // 3. Purge storage files to prevent orphans
  for (const item of filesToPurge) {
    try {
      await adminClient.storage.from(item.bucket).remove([item.path]);
    } catch {
      // Storage cleanup is best-effort
    }
  }

  // 4. Log audit event
  await adminClient.from('audit_logs').insert({
    actor_id: user.id,
    action: 'POST_DELETED',
    target_type: 'post',
    target_id: id,
    metadata: { title: existingPost.title, slug: existingPost.slug, purgedFilesCount: filesToPurge.length },
  });

  return NextResponse.json({ success: true, message: 'Post and associated storage assets deleted' });
}
