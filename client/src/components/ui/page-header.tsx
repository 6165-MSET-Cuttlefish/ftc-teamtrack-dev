import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A page title: the same size on every page, in the text colour of the theme
 * (the accent is kept for things that can be pressed). For a page whose title
 * block holds more than `PageHeader` does, its own h1 takes this class.
 */
export const PAGE_TITLE_CLASS =
  'text-3xl sm:text-4xl font-bold leading-tight text-foreground break-words [overflow-wrap:anywhere]';

interface PageHeaderProps {
  /** The page's one h1 */
  title: ReactNode;
  /** One quiet line under the title */
  subtitle?: ReactNode;
  /** Buttons for the page as a whole; right-aligned from `sm` up */
  actions?: ReactNode;
  /** Anything that belongs under the title block (a team switcher, tabs) */
  children?: ReactNode;
  className?: string;
}

/**
 * The top of a review page: the title in the text colour of the theme (the
 * accent is kept for things that can be pressed), an optional subtitle, and
 * the page's actions beside it. On a phone the actions drop under the title.
 */
export const PageHeader = ({
  title,
  subtitle,
  actions,
  children,
  className,
}: PageHeaderProps) => (
  <div
    className={cn(
      'mb-4 sm:mb-6 md:mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
      className
    )}
  >
    <div className="min-w-0 flex flex-col gap-3">
      <div className="min-w-0">
        <h1 className={PAGE_TITLE_CLASS}>{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
        {actions}
      </div>
    )}
  </div>
);
