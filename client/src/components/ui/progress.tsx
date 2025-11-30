import clsx from 'clsx';

interface ProgressProps {
  value?: number;
  className?: string;
}

export const Progress = ({ value = 0, className }: ProgressProps) => {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div
      className={clsx('w-full bg-gray-200 rounded-full', className)}
      style={{ height: 8 }}
    >
      <div
        className="bg-blue-500 h-full rounded-full"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};
