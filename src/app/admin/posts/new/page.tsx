import { requireRole } from '@/lib/auth';
import { PostEditor } from '@/components/admin/PostEditor';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create New Post | Admin CMS',
  description: 'Author and publish new blog posts, posters, and photography.',
};

export default async function NewPostPage() {
  await requireRole(['admin', 'super_admin'], '/admin/posts/new');

  return (
    <div className="py-2">
      <PostEditor isEditMode={false} />
    </div>
  );
}
