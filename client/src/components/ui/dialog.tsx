import React from 'react';

export const Dialog: React.FC<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}> = ({ children }) => {
  return <>{children}</>;
};

export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div {...props} className={className}>
    {children}
  </div>
);

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, ...props }) => (
  <h2 {...props}>{children}</h2>
);

export const DialogDescription: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <p {...props}>{children}</p>
);

export default Dialog;
