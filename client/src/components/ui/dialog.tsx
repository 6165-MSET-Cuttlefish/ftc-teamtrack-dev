import { ReactNode, HTMLAttributes, useEffect } from 'react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export const Dialog = ({ open = false, onOpenChange, children }: DialogProps) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && onOpenChange) {
      onOpenChange(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {children}
    </div>
  );
};

export const DialogContent = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    {...props}
    className={`bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-lg w-full ${className || ''}`}
    onClick={(e) => e.stopPropagation()}
  >
    {children}
  </div>
);

export const DialogHeader = ({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
    {children}
  </div>
);

export const DialogTitle = ({
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h2 {...props} className="text-lg font-semibold text-gray-900 dark:text-white">
    {children}
  </h2>
);

export const DialogDescription = ({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <p {...props} className="text-sm text-gray-500 dark:text-gray-400 mt-1">
    {children}
  </p>
);
