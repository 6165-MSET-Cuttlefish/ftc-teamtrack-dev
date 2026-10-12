import {
  ComponentProps,
  CSSProperties,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Toaster as Sonner, useSonner } from 'sonner';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants';
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
 * Where Sonner puts a desktop list, by its own defaults: 32px in from the
 * bottom-right corner, 356px wide, its stacked toasts 14px apart.
 */
const CORNER_OFFSET = 32;
const TOAST_WIDTH = 356;
const STACK_GAP = 14;
/**
 * A toast's height before one has been measured: one line of text beside
 * Undo, which grows to 44px for a finger
 */
const TOAST_HEIGHT = 58;
const TOUCH_TOAST_HEIGHT = 78;
/**
 * Over every toast Sonner keeps a strip as tall as the gap between two
 * (and 1px) that takes the pointer too, so it stays on the list going from
 * one toast to the next
 */
const POINTER_STRIP = STACK_GAP + 1;
/**
 * How far the close button's tap area reaches past the toast's top and
 * left edges, and its size: Sonner sets the 20px circle 6px over the
 * corner, and the area round it (`CLOSE_TAP_AREA`) is 44px across
 */
const CLOSE_REACH = 18;
const CLOSE_TAP_SIZE = 44;
/**
 * How far Sonner lifts a bottom list while the pointer is on it and more
 * toasts wait behind the front one. A touch screen's list stays put.
 */
const LIST_LIFT = 10;
const NO_LIFT_QUERY = '(hover: none) and (pointer: coarse)';
/** Space kept between the header and a list under it, in px */
const UNDER_HEADER_GAP = 12;

/**
 * Everything on the scoring page that can be pressed or typed in, and its
 * clock, which the scorer watches while a match runs. A desktop toast must
 * not land on any of them: on a laptop's short screen the End of Match
 * counters reach the bottom-right corner (Garden, Left in Hive), just as
 * End early puts its Undo toast there, and scrolled down, so do the Match
 * Log's rows and Session Notes.
 */
const PAGE_CONTROLS = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="textbox"]',
  '[data-match-timer]',
]
  .map(control => `main ${control}`)
  .join(', ');

/** How long a closed toast takes to leave, so its list stays put meanwhile */
const EXIT_MS = 400;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * What a toast at the right of a desktop list takes from the pointer, with
 * its top edge `top` px down the screen: the toast, Sonner's strip over it
 * (`POINTER_STRIP`), and the close button's tap area on its top-left
 * corner, all `lift` px higher while the list is lifted.
 */
const toastFootprint = (top: number, height: number, lift = 0): Box[] => {
  const right = document.documentElement.clientWidth - CORNER_OFFSET;
  const left = right - TOAST_WIDTH;
  const close = { left: left - CLOSE_REACH, top: top - CLOSE_REACH };
  return [
    { left, right, top: top - POINTER_STRIP - lift, bottom: top + height },
    {
      left: close.left,
      right: close.left + CLOSE_TAP_SIZE,
      top: close.top - lift,
      bottom: close.top + CLOSE_TAP_SIZE,
    },
  ];
};

/** True when one of the scoring page's controls is under any of `boxes` */
const controlUnder = (boxes: Box[]): boolean =>
  [...document.querySelectorAll(PAGE_CONTROLS)].some(control => {
    const box = control.getBoundingClientRect();
    return (
      box.width > 1 &&
      box.height > 1 &&
      boxes.some(
        area =>
          box.left < area.right &&
          box.right > area.left &&
          box.top < area.bottom &&
          box.bottom > area.top
      )
    );
  });

/**
 * Where a desktop list goes on the scoring page, in the order tried: its
 * bottom-right corner (Sonner's); the top right under the header, beside
 * the clock; over the header's right end, which holds nothing that can't
 * wait. The first with none of the page's controls under a toast.
 */
const SPOTS = ['corner', 'underHeader', 'overHeader'] as const;
type ListSpot = (typeof SPOTS)[number];

interface Spot {
  spot: ListSpot;
  /** How far down the screen a list under the header starts, in px */
  underHeaderTop: number;
}

/**
 * For a list with `count` toasts (one in view): which of `SPOTS` have one
 * of the scoring page's controls under a toast there, and where a list
 * under the header starts
 */
const measureSpots = (count: number) => {
  const list = document.querySelector<HTMLElement>('[data-sonner-toaster]');
  const height =
    parseFloat(list?.style.getPropertyValue('--front-toast-height') ?? '') ||
    (window.matchMedia('(pointer: coarse)').matches
      ? TOUCH_TOAST_HEIGHT
      : TOAST_HEIGHT);
  const lift =
    count > 1 && !window.matchMedia(NO_LIFT_QUERY).matches ? LIST_LIFT : 0;
  const header = document.querySelector('header')?.getBoundingClientRect();
  const underHeaderTop = Math.max(0, header?.bottom ?? 0) + UNDER_HEADER_GAP;
  const bottomTop =
    document.documentElement.clientHeight - CORNER_OFFSET - height;
  const taken: Record<ListSpot, boolean> = {
    corner: controlUnder(toastFootprint(bottomTop, height, lift)),
    underHeader: controlUnder(toastFootprint(underHeaderTop, height)),
    overHeader: false,
  };
  return { taken, underHeaderTop };
};

const CORNER: Spot = { spot: 'corner', underHeaderTop: 0 };

/**
 * Where the desktop list goes on the scoring page: the first of `SPOTS`
 * with nothing under it, followed as the page scrolls and changes and as
 * toasts come, so the list is out of the way before a toast shows. While
 * toasts show it stays where it is until something comes under it there,
 * rather than hop back and forth as the page moves under it. It goes back
 * once the last one has left.
 */
const useListSpot = (watch: boolean): Spot => {
  const { toasts } = useSonner();
  const count = toasts.length;
  const [spot, setSpot] = useState<Spot>(CORNER);
  useLayoutEffect(() => {
    if (!watch) {
      setSpot(CORNER);
      return;
    }
    let frame = 0;
    const check = () => {
      const { taken, underHeaderTop } = measureSpots(count);
      setSpot(was => {
        const next =
          count > 0 && !taken[was.spot]
            ? was.spot
            : (SPOTS.find(place => !taken[place]) ?? 'overHeader');
        return next === was.spot && underHeaderTop === was.underHeaderTop
          ? was
          : { spot: next, underHeaderTop };
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    };
    // A toast that has just closed leaves from where it is
    const exit = count === 0 ? setTimeout(check, EXIT_MS) : undefined;
    if (count > 0) check();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // The page changing under a list that stays put (End early unlocks
    // the End of Match counters)
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(exit);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, [watch, count, toasts]);
  return spot;
};

/** Space kept between a list over the header and a button left of it, in px */
const HEADER_BUTTON_GAP = 8;

/**
 * At the top of a desktop screen a list is over the header's buttons at its
 * right end. It reaches left past any of them its edge would cut through
 * (the (?) at 1366px), or its close button's tap area would take the edge
 * of (at 1440px), so each is hidden whole or left whole, as over a phone's
 * header. Its width in px, or null where Sonner's own cuts none.
 */
const useTopListWidth = (atTop: boolean): number | null => {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!atTop) {
      setWidth(null);
      return;
    }
    const measure = () => {
      const buttons = [
        ...document.querySelectorAll('header button, header a[href]'),
      ]
        .map(button => button.getBoundingClientRect())
        .filter(box => box.width > 1 && box.height > 1);
      const right = document.documentElement.clientWidth - CORNER_OFFSET;
      let left = right - TOAST_WIDTH;
      // Each step left can land on the next button along
      for (let cut = true; cut; ) {
        const edge = left;
        const through = buttons.filter(
          box => box.left < edge && box.right > edge - CLOSE_REACH
        );
        cut = through.length > 0;
        if (cut) {
          left = Math.min(...through.map(box => box.left)) - HEADER_BUTTON_GAP;
        }
      }
      const reach = Math.ceil(right - left);
      setWidth(reach > TOAST_WIDTH ? reach : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [atTop]);
  return width;
};

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
 * Under 280px wide (a phone at 200% zoom) a toast's text beside its button
 * had a column a word wide ("Cleared / 62 pts / entered / ..."). There the
 * button goes on a line of its own under the text, at its end, wherever
 * the text would have less than 10rem beside it. The text leaves room for
 * an icon beside it (a success toast's check), so only the button wraps.
 */
const NARROW_WRAP = 'max-[279px]:flex-wrap';
const NARROW_CONTENT =
  'max-[279px]:grow max-[279px]:basis-[min(10rem,calc(100%-1.5rem))]';

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
  // On the scoring page they also move up while the corner holds a control
  // the scorer needs: under the header if that is clear, else over it (see
  // `useListSpot`).
  const onScoringPage = useLocation().pathname.includes(ROUTES.ACTIVE);
  const { spot, underHeaderTop } = useListSpot(!onTop && onScoringPage);
  const atTop = !onTop && (dialogOpen || spot !== 'corner');
  // Not over a dialog's backdrop, which takes the header's buttons out of
  // reach anyway: there the list stays as narrow as it can, off the dialog.
  const topWidth = useTopListWidth(!dialogOpen && spot === 'overHeader');
  // Over the header, one toast shows at a time: the ones stacked behind it
  // peeked out below and reached the scoring page's session row, and touching
  // the stack spread it out over each page's first row. A newer toast hides
  // the older ones until it is closed or expires. One with a button (Undo)
  // waits meanwhile, and comes back with the time it had left. So on the
  // scoring page at any size: a stack spread out under the pointer, or a
  // finger on a tablet, reached up over the End of Match counters.
  const position = onTop ? 'top-center' : 'bottom-right';
  const visibleToasts = onTop || onScoringPage ? 1 : DESKTOP_VISIBLE_TOASTS;
  const overHeader = {
    top: isShort ? OVER_SHORT_HEADER_TOP : OVER_HEADER_TOP,
    left: OVER_HEADER_SIDE,
    right: OVER_HEADER_SIDE,
  };
  const placement: Partial<ToasterProps> = onTop
    ? { offset: overHeader, mobileOffset: overHeader, gap: 0 }
    : {
        offset: {
          top:
            !dialogOpen && spot === 'underHeader' ? underHeaderTop : DIALOG_GAP,
          right: CORNER_OFFSET,
          bottom: CORNER_OFFSET,
        },
      };
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
      className={cn('toaster group', atTop && 'toaster-over-dialog')}
      // Errors, warnings and successes each get their own colour, so a
      // "could not save" cannot be read as "saved"; every toast can be
      // dismissed without waiting it out.
      richColors
      closeButton
      style={{
        ...SURFACE_VARS,
        ...(isDarkMode ? undefined : LIGHT_TEXT_VARS),
        ...(onTop ? OVER_HEADER_WIDTH : undefined),
        ...(topWidth ? { '--width': `${topWidth}px` } : undefined),
      }}
      toastOptions={{
        classNames: {
          // Tailwind's reset zeroes Sonner's 1px border, hence `border`. The
          // accent colour is what sets a plain toast off from a page of the
          // same colour, as on the app's dialogs and select lists; a coloured
          // toast keeps its own border colour (Sonner's rule is stronger).
          // One waiting behind a newer toast (past `visibleToasts`) is out of
          // reach as well as out of sight: Sonner only fades it out, and Tab
          // went on from the front toast's Undo to its unseen buttons.
          toast: cn(
            'group toast border border-[rgb(var(--team-blue)/0.4)] group-[.toaster]:shadow-lg data-[visible=false]:invisible',
            onTop &&
              cn(
                'py-1.5',
                NARROW_WRAP,
                isShort
                  ? cn(OVER_SHORT_HEADER_MIN_H, SHORT_CLOSE_BUTTON)
                  : OVER_HEADER_MIN_H
              )
          ),
          // Two lines of text still fit over the header, and break evenly
          // rather than leave one word on the second
          title: onTop ? 'leading-tight text-balance' : undefined,
          description: onTop ? 'leading-tight' : undefined,
          content: onTop ? NARROW_CONTENT : undefined,
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
