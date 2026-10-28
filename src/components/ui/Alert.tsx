import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', title, children, className = '' }: AlertProps) {
  const configs = {
    info: {
      icon: Info,
      wrapper: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    success: {
      icon: CheckCircle2,
      wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    warning: {
      icon: AlertTriangle,
      wrapper: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    error: {
      icon: AlertCircle,
      wrapper: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300',
      iconColor: 'text-red-600 dark:text-red-400',
    },
  };

  const current = configs[variant];
  const IconComponent = current.icon;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border p-4 text-xs ${current.wrapper} ${className}`}
    >
      <IconComponent className={`h-4 w-4 shrink-0 mt-0.5 ${current.iconColor}`} />
      <div className="space-y-1">
        {title && <h4 className="font-semibold text-sm leading-tight">{title}</h4>}
        <div className="leading-relaxed opacity-95">{children}</div>
      </div>
    </div>
  );
}
