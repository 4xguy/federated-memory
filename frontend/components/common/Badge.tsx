import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  dot = false,
  className,
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center gap-xs font-medium rounded-full border';

  const variantStyles = {
    default: 'bg-neutral-gray-100 text-neutral-gray-800 border-neutral-gray-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  };

  const sizeStyles = {
    sm: 'text-xs px-sm py-xs',
    md: 'text-sm px-md py-xs',
  };

  return (
    <span
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full',
            {
              'bg-neutral-gray-600': variant === 'default',
              'bg-green-600': variant === 'success',
              'bg-amber-600': variant === 'warning',
              'bg-red-600': variant === 'error',
              'bg-blue-600': variant === 'info',
            }
          )}
        />
      )}
      {children}
    </span>
  );
};