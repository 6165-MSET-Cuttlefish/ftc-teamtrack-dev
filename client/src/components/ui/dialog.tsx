import { ReactNode, HTMLAttributes, useEffect } from 'react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export const Dialog = ({
  open = false,
  onOpenChange,
  children,
}: DialogProps) => {
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
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
    className={`rounded-2xl shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-200 ${className || ''}`}
    onClick={e => e.stopPropagation()}
  >
    {children}
  </div>
);

export const DialogHeader = ({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={`px-6 py-5 border-b ${className}`}>
    {children}
  </div>
);

export const DialogTitle = ({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    {...props}
    className={`text-xl font-bold flex items-center gap-2 ${className}`}
  >
    {children}
  </h2>
);

export const DialogDescription = ({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <p {...props} className={`text-sm mt-1 ${className}`}>
    {children}
  </p>
);
