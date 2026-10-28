import React from 'react';

export interface PageContainerProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

export function PageContainer({
  title,
  description,
  actions,
  badge,
  children,
  className = '',
  size = 'lg',
}: PageContainerProps) {
  const sizeMap = {
    sm: 'max-w-3xl',
    md: 'max-w-5xl',
    lg: 'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    <div className={`mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 ${sizeMap[size]} ${className}`}>
      {(title || description || actions || badge) && (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200 pb-5 dark:border-neutral-800">
          <div>
            {badge && <div className="mb-2">{badge}</div>}
            {title && (
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1.5 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
