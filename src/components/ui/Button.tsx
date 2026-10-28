import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

    const variantStyles = {
      primary:
        'bg-blue-600 text-white hover:bg-blue-500 focus:ring-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-xs',
      secondary:
        'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus:ring-neutral-400 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
      outline:
        'border border-neutral-300 bg-transparent hover:bg-neutral-50 text-neutral-700 focus:ring-neutral-400 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800',
      destructive:
        'bg-red-600 text-white hover:bg-red-500 focus:ring-red-600 dark:bg-red-700 dark:hover:bg-red-600 shadow-xs',
      ghost:
        'bg-transparent hover:bg-neutral-100 text-neutral-700 focus:ring-neutral-400 dark:text-neutral-300 dark:hover:bg-neutral-800',
    };

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
