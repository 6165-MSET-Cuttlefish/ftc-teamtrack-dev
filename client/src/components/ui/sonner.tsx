import { ComponentProps, CSSProperties, useRef } from 'react';
import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/contexts';
import { useIsCompact, useMediaQuery } from '@/hooks';
import { cn } from '@/lib/utils';
import { useIsDialogOpen } from './dialog';
import { useToastCountdowns } from './useToastCountdowns';

type ToasterProps = ComponentProps<typeof Sonner>;

/** Gap between the top of the screen and a toast shown over a dialog, in px */
const DIALOG_GAP = 12;

/** Toasts a desktop list shows at once (Sonner's own default) */
const DESKTOP_VISIBLE_TOASTS = 3;

/**
 * Where a toast starts on a phone: over the header bar, clear of the status
 * bar of a home-screen app and of the toast's own close button, which pokes
 * out above its top edge.
 */
const OVER_HEADER_TOP = 'calc(env(safe-area-inset-top, 0px) + 8px)';

/**
 * A phone held sideways: wide enough for the desktop layout, but too short
 * for a bottom toast to stay clear of the session buttons.
 */
const SHORT_VIEWPORT_QUERY = '(max-height: 500px)';

/**
 * Sonner's own colours, pointed at the app's surfaces. A plain toast is the
 * popover surface of the current theme. The action button (Undo) is the
 * inverse of that surface, and stays readable on every coloured toast too.
 */
const SURFACE_VARS = {
  '--normal-bg': 'hsl(var(--popover))',
  '--normal-text': 'hsl(var(--popover-foreground))',
  '--normal-border': 'hsl(var(--border))',
} as CSSProperties;

/**
 * Sonner's light-theme text colours for coloured toasts are 3.0 - 4.5:1 on
 * their tinted backgrounds. These are the same hues, dark enough to read
 * (6:1 or better). Its dark-theme colours are fine as they are.
 */
const LIGHT_TEXT_VARS = {
  '--success-text': '#166534',
  '--info-text': '#1e40af',
  '--warning-text': '#92400e',
  '--error-text': '#b91c1c',
} as CSSProperties;

const Toaster = ({ ...props }: ToasterProps) => {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? 'dark' : 'light';

  // On a phone a toast spans the full width. At the bottom it covered
  // Complete Session / Cancel Session — its Undo button sat right on top of
  // Cancel — and under the header it covered each page's first row: the
  // session row and clock while scoring, Charts / Compare / Export on the
  // sessions list. Phone-sized screens show toasts over the header bar
  // instead, which holds nothing that cannot wait a few seconds, and make
  // them slim enough to stay close to it. Desktop keeps Sonner's bottom-right
  // corner.
  const isCompact = useIsCompact();
  const isShort = useMediaQuery(SHORT_VIEWPORT_QUERY);
  const onTop = isCompact || isShort;
  // A dialog's buttons are at its bottom edge, and a wide dialog reaches the
  // bottom-right corner: a toast there sat on "Add Match" until it expired.
  // While a dialog is open, desktop toasts move to the top-right corner (see
  // `.toaster-over-dialog` in global.css). On a phone they are on top already.
  const dialogOpen = useIsDialogOpen();
  // Over the header, one toast shows at a time: the ones stacked behind it
  // peeked out below and reached the scoring page's session row, and touching
  // the stack spread it out over each page's first row. A newer toast hides
  // the older ones until it is closed or expires. One with a button (Undo)
  // waits meanwhile, and comes back with the time it had left.
  const position = onTop ? 'top-center' : 'bottom-right';
  const visibleToasts = onTop ? 1 : DESKTOP_VISIBLE_TOASTS;
  const placement: Partial<ToasterProps> = onTop
    ? {
        offset: { top: OVER_HEADER_TOP },
        mobileOffset: { top: OVER_HEADER_TOP },
        gap: 0,
      }
    : { offset: { top: DIALOG_GAP } };
  const sectionRef = useRef<HTMLElement>(null);
  useToastCountdowns({ sectionRef, position, visibleToasts });
  // A button in a toast over the header keeps Sonner's 24px height, so the
  // toast is no taller than the header; the invisible ring around it takes a
  // 44px tap, as on the close button. Elsewhere it grows to 44px on touch.
  const toastButton = onTop
    ? "relative min-h-0 min-w-0 after:absolute after:-inset-2.5 after:content-['']"
    : '[@media(pointer:coarse)]:min-h-11';

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className={cn(
        'toaster group',
        !onTop && dialogOpen && 'toaster-over-dialog'
      )}
      // Errors, warnings and successes each get their own colour, so a
      // "could not save" cannot be read as "saved"; every toast can be
      // dismissed without waiting it out.
      richColors
      closeButton
      style={
        isDarkMode ? SURFACE_VARS : { ...SURFACE_VARS, ...LIGHT_TEXT_VARS }
      }
      toastOptions={{
        classNames: {
          // Tailwind's reset zeroes Sonner's 1px border, hence `border`. The
          // accent colour is what sets a plain toast off from a page of the
          // same colour, as on the app's dialogs and select lists; a coloured
          // toast keeps its own border colour (Sonner's rule is stronger).
          toast: cn(
            'group toast border border-[rgb(var(--team-blue)/0.4)] group-[.toaster]:shadow-lg',
            onTop && 'py-1.5'
          ),
          // Two lines of text still fit over the header
          title: onTop ? 'leading-tight' : undefined,
          description: onTop ? 'leading-tight' : undefined,
          // The global phone rule would grow the 20px close circle to 44px.
          // It keeps its size; the invisible ring around it takes the tap.
          closeButton:
            "min-h-0 min-w-0 after:absolute after:-inset-3 after:content-['']",
          actionButton: toastButton,
          cancelButton: toastButton,
        },
      }}
      position={position}
      visibleToasts={visibleToasts}
      {...placement}
      {...props}
      ref={sectionRef}
    />
  );
};

export { Toaster };
