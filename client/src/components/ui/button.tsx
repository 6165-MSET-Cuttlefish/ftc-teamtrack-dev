import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-team-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-team-blue text-black hover:bg-team-blue/90 shadow-sm hover:shadow-md',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-team-blue-40 bg-transparent hover:bg-team-blue-10 hover:border-team-blue transition-colors',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-team-blue-10 hover:text-team-blue',
        link: 'text-team-blue underline-offset-4 hover:underline hover:text-team-blue/80',
        /*
         * The looks below carry their own text colour for every theme, so a
         * caller never passes one: each is at least 4.5:1 in the light, dark,
         * honeycomb and deep-sea themes (same pairs as session/controls/tones).
         */
        // The one filled button of a screen or dialog: the main action.
        primary:
          'bg-team-blue text-white dark:text-black shadow-sm hover:opacity-90',
        // An ordinary choice next to it (Cancel, Back, Keep editing).
        neutral:
          'border border-gray-500 bg-transparent text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/10',
        // Throws something away, but is not the main action of its screen.
        dangerOutline:
          'border border-red-600 bg-transparent text-red-700 hover:bg-red-50 dark:border-red-500/70 dark:text-red-400 dark:hover:bg-red-500/10',
        // Holds things up without losing anything (Pause). Honeycomb's accent
        // is gold as well, so there it falls back to the neutral outline.
        warning:
          'border border-yellow-600 bg-transparent text-yellow-800 hover:bg-yellow-50 dark:border-yellow-500/70 dark:text-yellow-300 dark:hover:bg-yellow-500/10 [.honeycomb_&]:border-gray-500 [.honeycomb_&]:text-gray-100 [.honeycomb_&]:hover:bg-white/10',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
        // 44px: the smallest comfortable target for a thumb.
        touch: 'h-11 px-4',
        // 48px: the main action of a screen.
        xl: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
