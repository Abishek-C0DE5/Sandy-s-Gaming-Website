import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400 mb-6">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Page Not Found</h1>
      <p className="mt-3 text-sm text-neutral-500 max-w-sm">
        The requested page could not be located, or may have been unpublished or moved.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Homepage</span>
        </Link>
      </div>
    </div>
  );
}
