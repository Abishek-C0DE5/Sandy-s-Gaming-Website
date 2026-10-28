import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export async function POST(request: NextRequest) {
  // 1. Authenticate caller and verify staff role
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, account_status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.account_status === 'suspended') {
    return NextResponse.json({ error: 'Forbidden: Account suspended or unverified' }, { status: 403 });
  }

  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: Staff privileges required' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const isDraft = formData.get('isDraft') === 'true';
    const folder = (formData.get('folder') as string | null) || 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file provided in request' }, { status: 400 });
    }

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported media type "${file.type}". Permitted types: JPEG, PNG, WebP, AVIF.` },
        { status: 400 }
      );
    }

    // 3. Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB limit.` },
        { status: 400 }
      );
    }

    // 4. Generate cryptographically random, sanitized storage path
    const ext = MIME_TO_EXT[file.type] || 'jpg';
    const cleanFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    const randomId = crypto.randomUUID();
    const storagePath = `${cleanFolder}/${Date.now()}_${randomId}.${ext}`;

    // Target bucket based on draft vs public intent
    const bucket = isDraft ? 'draft-media' : 'public-media';

    // 5. Upload binary via admin client
    const adminClient = await createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // 6. Compute URL
    let publicUrl = '';
    if (bucket === 'public-media') {
      const { data: urlData } = adminClient.storage.from(bucket).getPublicUrl(storagePath);
      publicUrl = urlData.publicUrl;
    } else {
      // Draft media: generate time-limited signed URL for preview
      const { data: signData } = await adminClient.storage.from(bucket).createSignedUrl(storagePath, 3600);
      publicUrl = signData?.signedUrl || '';
    }

    // 7. Audit log event
    await adminClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'MEDIA_ASSET_UPLOADED',
      target_type: 'storage',
      metadata: { bucket, storagePath, mimeType: file.type, sizeBytes: file.size, isDraft },
    });

    return NextResponse.json({
      success: true,
      bucket,
      storagePath,
      url: publicUrl,
      mediaType: file.type,
      sizeBytes: file.size,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload processing error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
