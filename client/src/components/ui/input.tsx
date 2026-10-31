import * as React from 'react';

import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * The outline every text field, select and notes box shares. Its colour is
 * set per theme in global.css (--field-border), at least 3:1 against what
 * is around a field, so a page or dialog gives a field its fill and leaves
 * the edge to this.
 */
export const FIELD_BORDER = 'border-[color:var(--field-border)]';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    const { isDarkMode } = useTheme();

    // Focus is the accent in every theme: its border and a solid ring of it
    // hugging the field (no offset, so no second outline in the page colour
    // around it), the same 2px a button's focus ring is. The ring is what
    // shows focus: the outline at rest is already about as dark as the
    // accent in light, so a border change or a faint ring would hardly show.
    // A field marked aria-invalid swaps both for the one red.
    const base = `flex h-12 w-full rounded-md px-3 py-2 text-base border ${FIELD_BORDER} file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-team-blue focus-visible:ring-offset-0 focus-visible:border-team-blue aria-[invalid=true]:focus-visible:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm`;

    const themeClasses = isDarkMode
      ? 'bg-team-dark text-white'
      : 'bg-[#FEFEFE] text-black';

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
