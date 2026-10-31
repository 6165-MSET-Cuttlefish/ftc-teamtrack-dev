import type { ReactNode } from 'react';
import { SECTION_TITLE_CLASS } from '@/components/ui/page-header';
import { cardClass } from './analysisCard';

export const Section = ({
  title,
  action,
  as: Heading = 'h2',
  className = '',
  children,
  isDarkMode,
}: {
  title: string;
  /** A control beside the title, e.g. one that shows or hides the content */
  action?: ReactNode;
  /** h3 where the card belongs to a heading above it (a match's breakdown) */
  as?: 'h2' | 'h3';
  className?: string;
  children?: ReactNode;
  isDarkMode: boolean;
}) => (
  <div className={`${cardClass(isDarkMode)} ${className}`}>
    <div
      className={`flex items-center justify-between gap-x-4 gap-y-1 flex-wrap ${children ? 'mb-4 sm:mb-5' : ''}`}
    >
      <Heading className={SECTION_TITLE_CLASS}>{title}</Heading>
      {action}
    </div>
    {children}
  </div>
);
