import { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  variant?: 'default' | 'secondary';
}

export const Badge = ({
  children,
  className,
  variant = 'default',
  ...props
}: BadgeProps) => {
  const base =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const variantClass =
    variant === 'secondary'
      ? 'bg-gray-200 text-gray-800'
      : 'bg-blue-100 text-blue-800';
  return (
    <span {...props} className={clsx(base, variantClass, className)}>
      {children}
    </span>
  );
};
