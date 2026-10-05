import * as React from 'react';

import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    const { isDarkMode } = useTheme();

    // Focus is the accent in every theme: its border and a soft ring of it
    // hugging the field (no offset, so no second outline in the page colour
    // around it). A field marked aria-invalid swaps both for the one red.
    const base =
      'flex h-12 w-full rounded-md px-3 py-2 text-base border file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-team-blue/30 focus-visible:ring-offset-0 focus-visible:border-team-blue aria-[invalid=true]:focus-visible:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';

    const themeClasses = isDarkMode
      ? 'border-team-white-20 bg-team-dark text-white'
      : 'border-team-blue/60 bg-[#FEFEFE] text-black';

    return (
      <input
        type={type}
        className={cn(base, themeClasses, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
