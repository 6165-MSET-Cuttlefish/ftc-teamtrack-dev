import React from 'react';
import clsx from 'clsx';

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'secondary' }> = ({ children, className, variant = 'default', ...props }) => {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const variantClass = variant === 'secondary' ? 'bg-gray-200 text-gray-800' : 'bg-blue-100 text-blue-800';
  return (
    <span {...props} className={clsx(base, variantClass, className)}>
      {children}
    </span>
  );
};

export default Badge;
