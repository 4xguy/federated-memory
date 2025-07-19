import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      interactive = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'rounded-xl transition-all duration-200';

    const variantStyles = {
      default: 'bg-neutral-white border border-neutral-gray-200',
      outlined: 'bg-transparent border border-neutral-gray-300',
      elevated: 'bg-neutral-white border border-neutral-gray-200 shadow-md',
    };

    const paddingStyles = {
      none: '',
      sm: 'p-md',
      md: 'p-lg',
      lg: 'p-xl',
    };

    const interactiveStyles = interactive
      ? 'cursor-pointer hover:shadow-lg hover:border-primary-300'
      : '';

    return (
      <div
        ref={ref}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          paddingStyles[padding],
          interactiveStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';