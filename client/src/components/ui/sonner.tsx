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
 * A phone on its side has a slim bar whose buttons start 4px down, and no
 * status bar over it: a toast starts level with them, so none of their
 * tops shows above it. Its close button sits lower on its corner there, to
 * stay on the screen.
 */
const OVER_SHORT_HEADER_TOP = 'calc(env(safe-area-inset-top, 0px) + 4px)';
const SHORT_CLOSE_BUTTON =
  '[--toast-close-button-transform:translate(-35%,-20%)]';

/**
 * The invisible 44px tap area round a toast's small buttons, an `::after`
 * on each. It is laid out from inside the button's 1px border, hence the
 * odd insets: 13px round the 20px close circle, 11px round the 24px-high
 * Undo.
 *
 * Over the header the close circle sits on the toast's top-left corner, 2px
 * from the screen's edges (1px down on a phone on its side): a ring round
 * it would be a third off the screen. There the area runs right and down
 * from the screen's corner instead, over the start of the toast, which a
 * tap closes anyway.
 *
 * Undo's area is lifted over Sonner's own strip along the toast's top edge
 * (the hover gap above it), which on a phone on its side, where the toast
 * is only 44px tall, would take the area's top pixel.
 */
const CLOSE_TAP_AREA = "after:absolute after:-inset-[13px] after:content-['']";
const CLOSE_TAP_AREA_OVER_HEADER =
  "after:absolute after:-left-[3px] after:-top-[2px] after:size-11 after:content-['']";
const ACTION_TAP_AREA =
  "after:absolute after:-inset-[11px] after:z-[1] after:content-['']";

/**
 * Over the header a toast reaches as far out as the header's own buttons
 * (their 44px circles end 8px from each edge), so none of them peeks out
 * past its ends.
 */
const OVER_HEADER_SIDE = 8;

/**
 * Sonner sizes a toast from the offsets only up to 600px wide; wider (a
 * phone on its side) it is a 356px box in the middle, which cut through
 * whichever header button it landed on. Over the header it spans the bar
 * there too.
 */
const OVER_HEADER_WIDTH = {
  '--width': `calc(100vw - ${2 * OVER_HEADER_SIDE}px)`,
} as CSSProperties;

/**
 * Over the header a toast is at least as tall as the header's row of 44px
 * buttons, so a one-line toast hides them whole instead of cutting them in
 * half: from 8px down it reaches past their bottom edge on every page (56px
 * on a 68px bar, 52px on the scoring page's). A phone on its side has a
 * slimmer bar (buttons at 4 - 48px), and a taller toast would reach past it
 * onto the scoring controls.
 */
const OVER_HEADER_MIN_H = 'min-h-[3.25rem]';
const OVER_SHORT_HEADER_MIN_H = 'min-h-11';

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
  // The accent, as on the toast's own border (see `toast` below): the close
  // button on its corner takes this on the dark themes, so the border runs
  // on round it instead of stopping short on either side.
  '--normal-border': 'rgb(var(--team-blue) / 0.4)',
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
  const overHeader = {
    top: isShort ? OVER_SHORT_HEADER_TOP : OVER_HEADER_TOP,
    left: OVER_HEADER_SIDE,
    right: OVER_HEADER_SIDE,
  };
  const placement: Partial<ToasterProps> = onTop
    ? { offset: overHeader, mobileOffset: overHeader, gap: 0 }
    : { offset: { top: DIALOG_GAP } };
  const sectionRef = useRef<HTMLElement>(null);
  useToastCountdowns({ sectionRef, position, visibleToasts });
  // A button in a toast over the header keeps Sonner's 24px height, so the
  // toast is no taller than the header; the invisible ring around it takes a
  // 44px tap (`ACTION_TAP_AREA`), inside the toast's own height, as on the
  // close button. Elsewhere it grows to 44px on touch.
  //
  // Either way it looks like the app's own buttons rather than Sonner's
  // square inverse chip, the brightest thing on screen: an outline in the
  // toast's own text colour, so it reads on a plain toast and a coloured one
  // alike. Sonner's rules for it outrank a class, hence the `!`s; where
  // color-mix() is missing the border is simply the full text colour. The
  // colour carries a `color:` hint: without it `cn` took it for a border
  // width and dropped `!border`, and Sonner's `border: none` left the width
  // at `medium`, a 3px ring.
  const toastButton = cn(
    '!rounded-lg !border !border-solid !border-[color:color-mix(in_srgb,currentColor_40%,transparent)] !bg-transparent !text-current font-semibold',
    onTop
      ? cn('relative min-h-0 min-w-0', ACTION_TAP_AREA)
      : '[@media(pointer:coarse)]:min-h-11'
  );

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
      style={{
        ...SURFACE_VARS,
        ...(isDarkMode ? undefined : LIGHT_TEXT_VARS),
        ...(onTop ? OVER_HEADER_WIDTH : undefined),
      }}
      toastOptions={{
        classNames: {
          // Tailwind's reset zeroes Sonner's 1px border, hence `border`. The
          // accent colour is what sets a plain toast off from a page of the
          // same colour, as on the app's dialogs and select lists; a coloured
          // toast keeps its own border colour (Sonner's rule is stronger).
          toast: cn(
            'group toast border border-[rgb(var(--team-blue)/0.4)] group-[.toaster]:shadow-lg',
            onTop &&
              cn(
                'py-1.5',
                isShort
                  ? cn(OVER_SHORT_HEADER_MIN_H, SHORT_CLOSE_BUTTON)
                  : OVER_HEADER_MIN_H
              )
          ),
          // Two lines of text still fit over the header, and break evenly
          // rather than leave one word on the second
          title: onTop ? 'leading-tight text-balance' : undefined,
          description: onTop ? 'leading-tight' : undefined,
          // The global phone rule would grow the 20px close circle to 44px.
          // It keeps its size; the invisible area around it takes the tap
          // (see `CLOSE_TAP_AREA`). Ringed in the toast's border colour
          // (Tailwind's reset had zeroed Sonner's ring; the dark themes take
          // the colour from --normal-border), it sits on the corner as a
          // badge instead of biting a piece out of the toast's border.
          closeButton: cn(
            'min-h-0 min-w-0 border border-[rgb(var(--team-blue)/0.4)]',
            onTop ? CLOSE_TAP_AREA_OVER_HEADER : CLOSE_TAP_AREA
          ),
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
