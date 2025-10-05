import * as React from 'react';

import { cn } from '@/lib/utils';

type SwitchProps = React.InputHTMLAttributes<HTMLInputElement> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
};

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(({ className, checked, onCheckedChange, ...props }, ref) => {
  return (
    <label className={cn('inline-flex items-center cursor-pointer', className)}>
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
        className="sr-only"
        {...props}
      />
      <span
        className={cn(
          'inline-block w-11 h-6 rounded-full transition-colors relative',
          checked ? 'bg-primary' : 'bg-input'
        )}
        aria-hidden
      >
        <span
          className={cn(
            'block w-5 h-5 bg-background rounded-full shadow transform transition-transform absolute top-0.5 left-0.5',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </span>
    </label>
  );
});
Switch.displayName = 'Switch';

export { Switch };
