import React from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  helpText?: string;
  inputSize?: 'sm' | 'md' | 'lg';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      success,
      helpText,
      inputSize = 'md',
      disabled = false,
      required = false,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const baseStyles = 'w-full font-sans rounded-lg border transition-all duration-200 outline-none';

    const sizeStyles = {
      sm: 'text-sm px-md py-sm h-8',
      md: 'text-base px-md py-md h-10',
      lg: 'text-lg px-lg py-lg h-12',
    };

    const stateStyles = error
      ? 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error focus:ring-opacity-10'
      : success
      ? 'border-semantic-success focus:border-semantic-success focus:ring-semantic-success focus:ring-opacity-10'
      : 'border-neutral-gray-300 focus:border-primary-500 focus:ring-primary-100';

    const disabledStyles = disabled
      ? 'bg-neutral-gray-100 text-neutral-gray-400 cursor-not-allowed'
      : 'bg-neutral-white';

    return (
      <div className="flex flex-col gap-sm">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-gray-700"
          >
            {label}
            {required && <span className="text-semantic-error ml-1">*</span>}
          </label>
        )}
        
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          required={required}
          className={clsx(
            baseStyles,
            sizeStyles[inputSize],
            stateStyles,
            disabledStyles,
            'focus:ring-4',
            className
          )}
          {...props}
        />
        
        {(error || helpText) && (
          <p
            className={clsx(
              'text-sm',
              error ? 'text-semantic-error' : 'text-neutral-gray-600'
            )}
          >
            {error || helpText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';