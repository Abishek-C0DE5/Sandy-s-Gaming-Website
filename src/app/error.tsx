'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client-side error securely
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 mb-6">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Something went wrong</h1>
      <p className="mt-2 text-sm text-neutral-500 max-w-md">
        An unexpected error occurred while processing this request. Our technical team has been notified.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
}
