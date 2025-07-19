import React, { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  dismissible?: boolean;
  centered?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  dismissible = true,
  centered = true,
  children,
  footer,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, dismissible]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && dismissible) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 flex bg-black/50',
        centered ? 'items-center justify-center' : 'items-start justify-center pt-20'
      )}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={clsx(
          'relative w-full bg-neutral-white rounded-xl shadow-xl max-h-[90vh] flex flex-col',
          sizeStyles[size],
          'mx-4'
        )}
      >
        {/* Header */}
        {(title || dismissible) && (
          <div className="flex items-center justify-between p-lg border-b border-neutral-gray-200">
            {title && (
              <h2 className="text-xl font-semibold text-neutral-gray-900">
                {title}
              </h2>
            )}
            {dismissible && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-neutral-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-neutral-gray-500" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 p-lg overflow-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex gap-md justify-end p-lg border-t border-neutral-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};