import { ReactNode, HTMLAttributes } from 'react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export const Dialog = ({ children }: DialogProps) => {
  return <>{children}</>;
};

export const DialogContent = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={className}>
    {children}
  </div>
);

export const DialogHeader = ({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;

export const DialogTitle = ({
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>;

export const DialogDescription = ({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => <p {...props}>{children}</p>;
