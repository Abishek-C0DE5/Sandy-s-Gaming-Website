'use client';

import React, { useState, useRef } from 'react';
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
  Bold,
  Italic,
  Heading2,
  Quote,
  List,
  Code,
  Link2,
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
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

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
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Handle title change with optional auto-slug
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (autoSlug) {
      setSlug(slugify(val));
    }
  };

  // Quick formatting insert helper
  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 10);
  };

  // Upload cover image directly to public storage
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
      formData.append('isDraft', 'false');
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
      setSuccessMsg('Cover image uploaded successfully to storage!');
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
        formData.append('isDraft', 'false');
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

      setTimeout(() => {
        router.push('/admin/posts');
        router.refresh();
      }, 600);
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
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
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
              {isEditMode ? 'Edit Post' : 'Create New Post'}
            </h1>
            <p className="text-xs text-neutral-500">
              Compose articles, upload artwork, and publish live to Sandy&apos;s Gaming.
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
            className="bg-[#D71932] hover:bg-[#b01328] text-white shadow-[0_0_12px_rgba(215,25,50,0.35)]"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
            )}
            <span>Publish Post</span>
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

      {/* 1. Post Type Selector (Clean Pill Grid) */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
          Content Category
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { type: 'blog', label: 'Blog Article', icon: BookOpen, desc: 'News, meta guides & tournament updates' },
            { type: 'poster', label: 'Tournament Poster', icon: Layers, desc: 'Showcase banners & schedule graphics' },
            { type: 'photo', label: 'Esports Photography', icon: Camera, desc: 'Event photography & high-res captures' },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = postType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setPostType(item.type as 'blog' | 'poster' | 'photo')}
                className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#D71932] bg-[#D71932]/10 text-[#D71932] dark:border-[#D71932] dark:bg-[#D71932]/15 shadow-xs font-semibold'
                    : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <Icon className="h-5 w-5 mb-1.5" />
                <span className="text-xs">{item.label}</span>
                <span className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">{item.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main Title, Slug & Summary Card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
        <div>
          <label htmlFor="post-title" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Post Title <span className="text-[#D71932]">*</span>
          </label>
          <input
            id="post-title"
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="e.g. Valorant Champions 2026: Tactical Breakdown & Player Highlights"
            className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-base font-semibold text-neutral-900 focus:border-[#D71932] focus:outline-hidden focus:ring-1 focus:ring-[#D71932] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="post-slug" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                URL Slug <span className="text-[#D71932]">*</span>
              </label>
              <button
                type="button"
                onClick={() => setAutoSlug(!autoSlug)}
                className="text-[11px] text-[#D71932] hover:underline cursor-pointer"
              >
                {autoSlug ? 'Auto-synced' : 'Set manually'}
              </button>
            </div>
            <div className="mt-1.5 flex items-center rounded-xl border border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/80 px-3 py-2">
              <span className="text-xs text-neutral-400 font-mono">
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
                placeholder="post-slug"
                className="w-full bg-transparent text-xs font-mono text-neutral-900 focus:outline-hidden dark:text-white ml-0.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Publish Status
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatus('draft')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  status === 'draft'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Draft (Hidden)
              </button>
              <button
                type="button"
                onClick={() => setStatus('published')}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  status === 'published'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Published (Live)
              </button>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="post-excerpt" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Summary / Short Excerpt
          </label>
          <textarea
            id="post-excerpt"
            rows={2}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="A compelling 1-2 sentence synopsis shown on cards and search engines..."
            className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white p-3 text-xs text-neutral-900 focus:border-[#D71932] focus:outline-hidden focus:ring-1 focus:ring-[#D71932] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
          />
        </div>
      </div>

      {/* 3. Cover Media Upload Card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-[#D71932]" />
              <span>Cover Image</span>
            </h3>
            <p className="text-xs text-neutral-500">Featured banner displayed on article headers and list cards.</p>
          </div>
          <span className="text-[11px] text-neutral-400">Max 5MB (JPG, PNG, WebP)</span>
        </div>

        {coverImage ? (
          <div className="space-y-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800">
              <Image
                src={coverImage}
                alt="Cover preview"
                fill
                sizes="(max-width: 1024px) 100vw, 800px"
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Cover Image Connected</span>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => document.getElementById('cover-file-input')?.click()}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                >
                  Replace Image
                </button>
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="text-red-600 dark:text-red-400 font-semibold hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-dashed border-neutral-300 p-6 text-center hover:border-[#D71932]/50 dark:border-neutral-700 dark:hover:border-[#D71932]/50 transition-colors bg-neutral-50/50 dark:bg-neutral-800/30">
              <input
                id="cover-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleCoverUpload}
                disabled={uploadingCover}
                className="hidden"
              />
              <div className="flex flex-col items-center">
                {uploadingCover ? (
                  <Loader2 className="h-8 w-8 animate-spin text-[#D71932]" />
                ) : (
                  <Upload className="h-8 w-8 text-neutral-400" />
                )}
                <span className="mt-2 text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  {uploadingCover ? 'Uploading to Supabase Storage...' : 'Upload Cover Image'}
                </span>
                <p className="mt-0.5 text-xs text-neutral-400">
                  PNG, JPG, or WebP up to 5MB
                </p>
                <button
                  type="button"
                  onClick={() => document.getElementById('cover-file-input')?.click()}
                  disabled={uploadingCover}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#D71932] px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(215,25,50,0.3)] hover:bg-[#b01328] transition-all cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  <span>{uploadingCover ? 'Uploading...' : 'Choose Image File'}</span>
                </button>
              </div>
            </div>

            {/* Direct image link option */}
            <div className="pt-2 flex items-center justify-between">
              {!showUrlInput ? (
                <button
                  type="button"
                  onClick={() => setShowUrlInput(true)}
                  className="text-xs text-neutral-500 hover:text-[#D71932] dark:hover:text-white transition-colors cursor-pointer"
                >
                  &rarr; Or paste an existing image URL instead
                </button>
              ) : (
                <div className="w-full flex gap-2">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs text-neutral-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (imageUrlInput.trim()) {
                        setCoverImage(imageUrlInput.trim());
                        setImageUrlInput('');
                        setShowUrlInput(false);
                      }
                    }}
                    className="rounded-xl bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white px-4 py-1.5 text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Attach
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Rich Article Content Composer */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800 gap-3">
          <div>
            <label className="text-sm font-bold text-neutral-900 dark:text-white">
              Article Content
            </label>
            <p className="text-xs text-neutral-500">Write your article body. Use the formatting bar or Markdown.</p>
          </div>

          <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-50 p-1 text-xs dark:border-neutral-700 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => setActiveTab('write')}
              className={`rounded-lg px-3 py-1 font-semibold transition-colors cursor-pointer ${
                activeTab === 'write'
                  ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition-colors cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Live Preview</span>
            </button>
          </div>
        </div>

        {/* Formatting Helper Toolbar */}
        {activeTab === 'write' && (
          <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xl bg-neutral-100 p-1.5 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60">
            <button
              type="button"
              onClick={() => insertFormatting('## ', '', 'Section Heading')}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('**', '**', 'bold text')}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*', '*', 'italic text')}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </button>
            <span className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />
            <button
              type="button"
              onClick={() => insertFormatting('> ', '', 'Quoted thought')}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              title="Quote block"
            >
              <Quote className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('- ', '', 'List item')}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              title="Bullet list"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('```\n', '\n```', 'code block')}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              title="Code block"
            >
              <Code className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('[Link title](', ')', 'https://example.com')}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              title="Hyperlink"
            >
              <Link2 className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-3">
          {activeTab === 'write' ? (
            <textarea
              ref={bodyTextareaRef}
              rows={16}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Start composing your article here... Use headings, bullet points, and code blocks."
              className="w-full rounded-xl border border-neutral-300 bg-white p-4 font-mono text-sm leading-relaxed text-neutral-900 focus:border-[#D71932] focus:outline-hidden focus:ring-1 focus:ring-[#D71932] dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          ) : (
            <div className="min-h-[380px] rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-sm leading-relaxed dark:border-neutral-800 dark:bg-neutral-900/50">
              {body ? (
                <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                  {body}
                </div>
              ) : (
                <p className="text-neutral-400 italic">No article content yet. Switch to Write mode to compose.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Additional Gallery Media (only if poster or photo) */}
      {(postType === 'poster' || postType === 'photo') && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Gallery Showcase Assets
              </h3>
              <p className="text-xs text-neutral-500">Additional photography captures or high-resolution tournament posters.</p>
            </div>
            <span className="text-xs text-neutral-400">{mediaList.length} items</span>
          </div>

          {mediaList.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {mediaList.map((item, idx) => (
                <div
                  key={idx}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 dark:border-neutral-800"
                >
                  {item.url ? (
                    <Image
                      src={item.url}
                      alt=""
                      fill
                      sizes="180px"
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
                    className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border-2 border-dashed border-neutral-300 p-5 text-center hover:border-[#D71932]/50 dark:border-neutral-700 transition-colors bg-neutral-50/50 dark:bg-neutral-800/30">
            <input
              id="gallery-file-input"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleGalleryUpload}
              disabled={uploadingGallery}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                {uploadingGallery ? 'Uploading gallery photos...' : 'Add multiple images to this gallery post'}
              </span>
              <button
                type="button"
                onClick={() => document.getElementById('gallery-file-input')?.click()}
                disabled={uploadingGallery}
                className="mt-1 inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Select Photos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Sticky Bottom Action Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-md">
        <Link
          href="/admin/posts"
          className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium"
        >
          &larr; Cancel &amp; Return to Posts
        </Link>

        <div className="flex items-center gap-3">
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
            <span>Save as Draft</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSubmit('published')}
            className="bg-[#D71932] hover:bg-[#b01328] text-white shadow-[0_0_15px_rgba(215,25,50,0.35)]"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
            )}
            <span>Publish Post Now</span>
          </Button>
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
              <span>Confirm &amp; Delete</span>
            )}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
