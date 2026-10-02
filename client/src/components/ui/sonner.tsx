import { ComponentProps, useEffect, useState } from 'react';
import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/contexts';
import { useIsCompact, useMediaQuery } from '@/hooks';

type ToasterProps = ComponentProps<typeof Sonner>;

/** Gap between the sticky header and the first toast, in px */
const HEADER_GAP = 8;

/**
 * A phone held sideways: wide enough for the desktop layout, but too short
 * for a bottom toast to stay clear of the session buttons.
 */
const SHORT_VIEWPORT_QUERY = '(max-height: 500px)';

/**
 * Height of the sticky app header, tracked as it changes (the compact match
 * clock adds a row to it on a phone). 0 when there is no header to clear.
 */
const useHeaderHeight = (enabled: boolean): number => {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const header = document.querySelector('header');
    if (!header) return;
    const measure = () =>
      setHeight(Math.round(header.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [enabled]);

  return enabled ? height : 0;
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? 'dark' : 'light';

  // On a phone a toast spans the full width, and at the bottom it covered
  // Complete Session / Cancel Session — its Undo button sat right on top of
  // Cancel. Phone-sized screens show toasts under the header instead; desktop
  // keeps Sonner's bottom-right corner.
  const isCompact = useIsCompact();
  const isShort = useMediaQuery(SHORT_VIEWPORT_QUERY);
  const toastsOnTop = isCompact || isShort;
  const headerHeight = useHeaderHeight(toastsOnTop);
  const compactProps: Partial<ToasterProps> = toastsOnTop
    ? {
        position: 'top-center',
        offset: { top: headerHeight + HEADER_GAP },
        mobileOffset: { top: headerHeight + HEADER_GAP },
      }
    : {};

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          warning:
            'group-[.toaster]:!bg-yellow-950 group-[.toaster]:!border-yellow-500 group-[.toaster]:!text-yellow-100',
        },
      }}
      {...compactProps}
      {...props}
    />
  );
};

export { Toaster };
