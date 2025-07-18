import { forwardRef } from 'react';
import { clsx } from 'clsx';

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, loading, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
      ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500',
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm rounded-md',
      md: 'px-4 py-2 text-base rounded-lg',
      lg: 'px-6 py-3 text-lg rounded-lg',
    };
    
    return (
      <button
        ref={ref}
        className={clsx(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Input Component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, iconPosition = 'left', ...props }, ref) => {
    return (
      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'block w-full rounded-lg border bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white dark:placeholder-gray-500',
            error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600',
            icon && iconPosition === 'left' && 'pl-10',
            icon && iconPosition === 'right' && 'pr-10',
            className
          )}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Label Component
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={clsx('block text-sm font-medium text-gray-700 dark:text-gray-300', className)}
        {...props}
      />
    );
  }
);

Label.displayName = 'Label';

// Form Field Component
interface FormFieldProps {
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ children, className }) => {
  return <div className={clsx('space-y-1', className)}>{children}</div>;
};

// Error Message Component
interface ErrorMessageProps {
  children: React.ReactNode;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ children, className }) => {
  return (
    <p className={clsx('text-sm text-red-600 dark:text-red-400', className)}>
      {children}
    </p>
  );
};

// Heading Component
interface HeadingProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children: React.ReactNode;
  className?: string;
}

export const Heading: React.FC<HeadingProps> = ({ 
  as: Component = 'h2', 
  variant = 'h2', 
  children, 
  className 
}) => {
  const variants = {
    h1: 'text-4xl font-bold text-gray-900 dark:text-white',
    h2: 'text-3xl font-bold text-gray-900 dark:text-white',
    h3: 'text-2xl font-semibold text-gray-900 dark:text-white',
    h4: 'text-xl font-semibold text-gray-900 dark:text-white',
    h5: 'text-lg font-medium text-gray-900 dark:text-white',
    h6: 'text-base font-medium text-gray-900 dark:text-white',
  };

  return (
    <Component className={clsx(variants[variant], className)}>
      {children}
    </Component>
  );
};

// Text Component
interface TextProps {
  variant?: 'body' | 'caption' | 'small';
  children: React.ReactNode;
  className?: string;
}

export const Text: React.FC<TextProps> = ({ variant = 'body', children, className }) => {
  const variants = {
    body: 'text-base text-gray-600 dark:text-gray-400',
    caption: 'text-sm text-gray-500 dark:text-gray-500',
    small: 'text-xs text-gray-500 dark:text-gray-500',
  };

  return (
    <p className={clsx(variants[variant], className)}>
      {children}
    </p>
  );
};