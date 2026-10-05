import { Lock, LockOpen } from 'lucide-react';
import { useTheme } from '@/contexts';

/**
 * A muted line that says what state a section is in, or why it is locked.
 * Balanced, so a note that has to wrap doesn't leave one word on its own.
 */
export const SectionNote = ({
  id,
  icon,
  align = 'left',
  visuallyHidden = false,
  children,
}: {
  /** Lets the controls the note is about point at it (`aria-describedby`) */
  id?: string;
  icon?: 'locked' | 'unlocked';
  align?: 'left' | 'right';
  /**
   * Read out (and still what its controls point at) but not shown: for a
   * note the screen already shows nearby, such as 'Unlocks at Start'.
   */
  visuallyHidden?: boolean;
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  const Icon = icon === 'locked' ? Lock : LockOpen;
  if (visuallyHidden) {
    return (
      <p id={id} className="sr-only">
        {children}
      </p>
    );
  }
  return (
    <p
      id={id}
      className={`min-w-0 text-xs leading-4 text-balance ${
        align === 'right' ? 'text-right' : ''
      } ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
    >
      {/* Inline, so it stays beside the first word when the note wraps */}
      {icon && (
        <Icon
          size={12}
          aria-hidden
          className="mr-1.5 inline-block align-[-1px]"
        />
      )}
      {children}
    </p>
  );
};
