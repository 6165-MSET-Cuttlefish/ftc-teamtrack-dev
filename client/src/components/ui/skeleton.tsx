import React from 'react';
import clsx from 'clsx';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => {
  return (
    <div
      {...props}
      className={clsx('animate-pulse bg-gray-200 rounded', className)}
    />
  );
};

export default Skeleton;
