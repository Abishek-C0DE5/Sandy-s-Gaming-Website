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
      className={`flex min-h-[260px] flex-col items-center justify-center rounded-2xl glass p-8 text-center ${className}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl glass-elevated text-[var(--brand-primary)] animate-float">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-bold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs text-[var(--text-secondary)] leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
