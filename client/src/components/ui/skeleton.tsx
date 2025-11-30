import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export const Skeleton = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      {...props}
      className={clsx('animate-pulse bg-gray-200 rounded', className)}
    />
  );
};
