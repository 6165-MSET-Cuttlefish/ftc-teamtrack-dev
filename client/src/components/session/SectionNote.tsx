import { Lock, LockOpen } from 'lucide-react';
import { useTheme } from '@/contexts';

/** A muted line that says what state a section is in, or why it is locked. */
export const SectionNote = ({
  id,
  icon,
  align = 'left',
  children,
}: {
  /** Lets the controls the note is about point at it (`aria-describedby`) */
  id?: string;
  icon?: 'locked' | 'unlocked';
  align?: 'left' | 'right';
  children: React.ReactNode;
}) => {
  const { isDarkMode } = useTheme();
  const Icon = icon === 'locked' ? Lock : LockOpen;
  return (
    <p
      id={id}
      className={`min-w-0 text-xs leading-4 ${
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
