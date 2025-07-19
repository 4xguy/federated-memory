import React from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center gap-sm font-medium rounded-lg border transition-all duration-200 no-underline focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variantStyles = {
      primary: 'bg-primary-600 text-neutral-white border-primary-600 hover:bg-primary-700 hover:border-primary-700 focus:ring-primary-500',
      secondary: 'bg-neutral-gray-100 text-neutral-gray-900 border-neutral-gray-300 hover:bg-neutral-gray-200 hover:border-neutral-gray-400',
      outline: 'bg-transparent text-primary-600 border-primary-600 hover:bg-primary-50 hover:text-primary-700',
      ghost: 'bg-transparent text-neutral-gray-600 border-transparent hover:bg-neutral-gray-100 hover:text-neutral-gray-900',
      danger: 'bg-semantic-error text-neutral-white border-semantic-error hover:bg-red-600 hover:border-red-600',
    };

    const sizeStyles = {
      sm: 'text-sm px-md py-sm h-8',
      md: 'text-base px-lg py-md h-10',
      lg: 'text-lg px-xl py-lg h-12',
    };

    const disabledStyles = disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer';
    const loadingStyles = loading ? 'cursor-wait opacity-80' : '';
    const widthStyles = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          disabledStyles,
          loadingStyles,
          widthStyles,
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';