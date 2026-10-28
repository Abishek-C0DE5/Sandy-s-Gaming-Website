import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-800 ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-neutral-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
