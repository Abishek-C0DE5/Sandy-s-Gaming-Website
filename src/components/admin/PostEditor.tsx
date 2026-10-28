'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Image as ImageIcon,
  BookOpen,
  Camera,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/Alert';

export interface PostData {
  id?: string;
  title: string;
  slug: string;
  post_type: 'blog' | 'poster' | 'photo';
  status: 'draft' | 'published' | 'archived';
  excerpt: string;
  body: string;
  cover_image: string | null;
  media?: Array<{
    storage_path: string;
    media_type: string;
    alt_text?: string | null;
    sort_order: number;
    url?: string;
  }>;
}

interface PostEditorProps {
  initialData?: PostData;
  isEditMode?: boolean;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function PostEditor({ initialData, isEditMode = false }: PostEditorProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [autoSlug, setAutoSlug] = useState(!isEditMode);
  const [postType, setPostType] = useState<'blog' | 'poster' | 'photo'>(
    initialData?.post_type || 'blog'
  );
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(
    initialData?.status || 'draft'
  );
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || '');
  const [body, setBody] = useState(initialData?.body || '');
  const [coverImage, setCoverImage] = useState<string | null>(initialData?.cover_image || null);
  const [mediaList, setMediaList] = useState<Array<{
    storage_path: string;
    media_type: string;
    alt_text?: string | null;
    sort_order: number;
    url?: string;
  }>>(initialData?.media || []);

  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle title change with optional auto-slug
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (autoSlug) {
      setSlug(slugify(val));
    }
  };

  // Upload cover image
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError(`Unsupported file type (${file.type}). Allowed: JPEG, PNG, WebP, AVIF.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds 5 MB limit.`);
      return;
    }

    setUploadingCover(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('isDraft', status === 'draft' ? 'true' : 'false');
      formData.append('folder', 'covers');

      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setCoverImage(data.url);
      setSuccessMsg(`Cover image uploaded to ${data.bucket} successfully.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload error';
      setError(msg);
    } finally {
      setUploadingCover(false);
    }
  };

  // Upload gallery media item
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          throw new Error(`File ${file.name} has unsupported type (${file.type}).`);
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File ${file.name} exceeds 5MB limit.`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('isDraft', status === 'draft' ? 'true' : 'false');
        formData.append('folder', 'gallery');

        const res = await fetch('/api/admin/media/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gallery item upload failed');

        setMediaList((prev) => [
          ...prev,
          {
            storage_path: data.storagePath,
            media_type: data.mediaType,
            alt_text: title || 'Gallery Image',
            sort_order: prev.length,
            url: data.url,
          },
        ]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gallery upload error';
      setError(msg);
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryItem = (index: number) => {
    setMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit form
  const handleSubmit = async (targetStatus?: 'draft' | 'published') => {
    const finalStatus = targetStatus || status;
    setError(null);
    setSuccessMsg(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!slug.trim()) {
      setError('Slug is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        post_type: postType,
        status: finalStatus,
        excerpt: excerpt.trim() || null,
        body: body || null,
        cover_image: coverImage || null,
        media: mediaList.map((m, idx) => ({
          storage_path: m.storage_path,
          media_type: m.media_type,
          alt_text: m.alt_text || title,
          sort_order: idx,
        })),
      };

      const url = isEditMode && initialData?.id
        ? `/api/admin/posts/${initialData.id}`
        : '/api/admin/posts';

      const method = isEditMode ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'Failed to save post.');
      }

      setSuccessMsg(
        isEditMode
          ? 'Post updated successfully!'
          : `Post successfully created as ${finalStatus}!`
      );

      // Brief delay so user sees confirmation before navigation
      setTimeout(() => {
        router.push('/admin/posts');
        router.refresh();
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  // Delete post handler
  const handleDelete = async () => {
    if (!initialData?.id) return;
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/posts/${initialData.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete post');
      }

      setShowDeleteModal(false);
      router.push('/admin/posts');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete error';
      setError(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/posts"
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {isEditMode ? 'Edit Content Post' : 'Create New Content Post'}
            </h1>
            <p className="text-xs text-neutral-500">
              {isEditMode
                ? 'Update copy, replace media, or change publishing visibility.'
                : 'Author blog articles, poster showcases, or photography releases.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isEditMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/20"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <span>Delete</span>
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSubmit('draft')}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <FileText className="h-4 w-4 mr-1.5" />
            )}
            <span>Save Draft</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSubmit('published')}
            className="bg-blue-600 hover:bg-blue-500"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
            )}
            <span>Publish Now</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <Alert variant="error" title="Submission Error">
          {error}
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success" title="Success">
          {successMsg}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Post Type Selector */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              Post Content Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: 'blog', label: 'Blog Article', icon: BookOpen, desc: 'Rich articles & updates' },
                { type: 'poster', label: 'Poster Showcase', icon: Layers, desc: 'Graphic designs & banners' },
                { type: 'photo', label: 'Photography', icon: Camera, desc: 'Visual galleries & captures' },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = postType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setPostType(item.type as 'blog' | 'poster' | 'photo')}
                    className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 dark:bg-blue-950/30 dark:border-blue-500 dark:text-blue-300 shadow-xs'
                        : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Icon className="h-5 w-5 mb-1.5" />
                    <span className="text-xs font-semibold">{item.label}</span>
                    <span className="text-[10px] text-neutral-500 mt-0.5">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title and Slug */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
            <div>
              <label htmlFor="post-title" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="post-title"
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="e.g. Next-Gen Gaming Performance Breakthroughs"
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="post-slug" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAutoSlug(!autoSlug)}
                  className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                >
                  {autoSlug ? 'Switch to manual slug' : 'Sync slug with title'}
                </button>
              </div>
              <div className="mt-1.5 flex items-center rounded-lg border border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
                <span className="px-3 text-xs text-neutral-400 font-mono">
                  {postType === 'blog' ? '/blog/' : '/posts/'}
                </span>
                <input
                  id="post-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    setAutoSlug(false);
                  }}
                  placeholder="post-url-slug"
                  className="w-full bg-transparent py-2 pr-3 text-xs font-mono text-neutral-900 focus:outline-none dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="post-excerpt" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Summary / Excerpt
              </label>
              <textarea
                id="post-excerpt"
                rows={2}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="A concise synopsis displayed on post preview cards and search engines..."
                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white p-3 text-xs text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          {/* Body Content Editor & Live Preview */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Article Body Content
              </label>
              <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    activeTab === 'write'
                      ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  Markdown Editor
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1 rounded-md px-3 py-1 font-medium transition-colors ${
                    activeTab === 'preview'
                      ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </button>
              </div>
            </div>

            <div className="mt-4">
              {activeTab === 'write' ? (
                <textarea
                  rows={14}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write post content using Markdown formatting (# Headings, **bold**, lists, etc.)..."
                  className="w-full rounded-lg border border-neutral-300 bg-white p-3.5 font-mono text-xs text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              ) : (
                <div className="min-h-[350px] rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900/50">
                  {body ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {body}
                    </div>
                  ) : (
                    <p className="text-neutral-400 italic">No content written yet. Switch to Editor to compose.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Configuration (1 col) */}
        <div className="space-y-6">
          {/* Status & Visibility */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
              Publishing Status
            </h3>
            <div className="space-y-2">
              {[
                { val: 'draft', label: 'Draft', desc: 'Private to staff; protected in draft-media.' },
                { val: 'published', label: 'Published', desc: 'Visible on public website.' },
                ...(isEditMode
                  ? [{ val: 'archived', label: 'Archived', desc: 'Hidden from public listings.' }]
                  : []),
              ].map((item) => (
                <label
                  key={item.val}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    status === item.val
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-500'
                      : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="post_status"
                    value={item.val}
                    checked={status === item.val}
                    onChange={() => setStatus(item.val as 'draft' | 'published' | 'archived')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-semibold capitalize text-neutral-900 dark:text-white">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Cover Media Asset */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Cover Media
              </h3>
              <span className="text-[11px] text-neutral-400">Max 5MB (JPG, PNG, WebP)</span>
            </div>

            {coverImage ? (
              <div className="space-y-3">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800">
                  <Image
                    src={coverImage}
                    alt="Cover preview"
                    fill
                    sizes="(max-width: 768px) 100vw, 300px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Asset Connected</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCoverImage(null)}
                    className="text-red-500 hover:text-red-600 text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600 transition-colors">
                <input
                  id="cover-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleCoverUpload}
                  disabled={uploadingCover}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex flex-col items-center">
                  {uploadingCover ? (
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  ) : (
                    <Upload className="h-8 w-8 text-neutral-400" />
                  )}
                  <span className="mt-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    {uploadingCover ? 'Uploading file to storage...' : 'Click or drag image to upload'}
                  </span>
                  <span className="mt-1 text-[10px] text-neutral-400">
                    Routing to {status === 'draft' ? 'draft-media (private)' : 'public-media (public)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Secondary Gallery Media (for Posters / Photography) */}
          {(postType === 'poster' || postType === 'photo') && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Gallery Showcase Assets
                </h3>
                <span className="text-[11px] text-neutral-400">{mediaList.length} items</span>
              </div>

              {mediaList.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {mediaList.map((item, idx) => (
                    <div
                      key={idx}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 dark:border-neutral-800"
                    >
                      {item.url ? (
                        <Image
                          src={item.url}
                          alt=""
                          fill
                          sizes="150px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-neutral-400">
                          {item.storage_path}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeGalleryItem(idx)}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative border-2 border-dashed border-neutral-300 rounded-xl p-4 text-center hover:border-neutral-400 dark:border-neutral-700 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleGalleryUpload}
                  disabled={uploadingGallery}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {uploadingGallery ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-neutral-400" />
                  )}
                  <span>{uploadingGallery ? 'Uploading gallery...' : 'Add Gallery Images'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Post Deletion"
        description="This action will permanently delete this post and remove all associated media binaries from Supabase Storage."
      >
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-500 text-white"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                <span>Deleting Assets...</span>
              </>
            ) : (
              <span>Confirm & Delete</span>
            )}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
