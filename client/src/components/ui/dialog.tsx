import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { cn } from '@/lib/utils';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/** Popups a dialog's own controls open outside it (Select listbox, menus) */
const POPUP =
  '[data-radix-popper-content-wrapper], [role="listbox"], [role="menu"]';

/** Elements inside `node` that Tab can land on, in order */
const focusableIn = (node: HTMLElement): HTMLElement[] =>
  Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    el => el.getClientRects().length > 0
  );

/**
 * Whether `el` is wholly on screen in a dialog that has just opened, with
 * its backdrop scrolled to the top. Added up from layout offsets, which
 * leave out the panel's zoom-in (a transform) that a rect taken now would
 * include. The panel's offset parent is the backdrop's column.
 */
const isOnScreenAtOpen = (el: HTMLElement, panel: HTMLElement): boolean => {
  const column = panel.offsetParent;
  if (!(column instanceof HTMLElement)) return false;
  let top = column.getBoundingClientRect().top;
  let node: Element | null = el;
  while (node !== column) {
    if (!(node instanceof HTMLElement)) return false;
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return top >= 0 && top + el.offsetHeight <= window.innerHeight;
};

/** Open dialog panels, outermost first: only the last one traps Tab */
const openPanels: HTMLElement[] = [];

/** Open dialogs, oldest first: only the last one answers Escape */
const openDialogs: symbol[] = [];

/** Told whenever the first dialog opens or the last one closes */
const openListeners = new Set<() => void>();

/** The page scrolls again once the last open dialog closes */
let scrollLocks = 0;
let overflowBeforeLock = '';

const lockScroll = () => {
  if (scrollLocks === 0) {
    overflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
  if (scrollLocks === 1) openListeners.forEach(listener => listener());
};

const unlockScroll = () => {
  scrollLocks -= 1;
  if (scrollLocks === 0) {
    document.body.style.overflow = overflowBeforeLock;
    openListeners.forEach(listener => listener());
  }
};

const subscribeToOpenDialogs = (listener: () => void) => {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
};

const isAnyDialogOpen = () => scrollLocks > 0;

/**
 * True while at least one Dialog is open. For anything that has to stay
 * clear of a dialog, like the toasts that would otherwise sit on its footer.
 */
export const useIsDialogOpen = (): boolean =>
  useSyncExternalStore(subscribeToOpenDialogs, isAnyDialogOpen, () => false);

/** Lets DialogTitle / DialogDescription name the panel they sit in */
interface DialogLabelContextValue {
  titleId: string;
  descriptionId: string;
  setTitleId: (id: string | null) => void;
  setDescriptionId: (id: string | null) => void;
}

const DialogLabelContext = createContext<DialogLabelContextValue | null>(null);

export const Dialog = ({
  open = false,
  onOpenChange,
  children,
}: DialogProps) => {
  const [dialogId] = useState(() => Symbol('dialog'));
  // One press closes one thing: with two dialogs open, only the one on top.
  useEscapeKey(open, () => {
    if (openDialogs[openDialogs.length - 1] !== dialogId) return;
    onOpenChange?.(false);
  });
  /** A click only dismisses if it also started on the backdrop (not a text-selection drag) */
  const pressedBackdropRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    openDialogs.push(dialogId);
    lockScroll();
    return () => {
      const index = openDialogs.indexOf(dialogId);
      if (index !== -1) openDialogs.splice(index, 1);
      unlockScroll();
    };
  }, [open, dialogId]);

  if (!open) return null;

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    const pressedBackdrop = pressedBackdropRef.current;
    pressedBackdropRef.current = false;
    if (e.target === e.currentTarget && pressedBackdrop && onOpenChange) {
      onOpenChange(false);
    }
  };

  // In a portal at the end of <body>: the dialog opened last is the last one
  // in the page, so it is both the one on top and the one holding focus, and
  // no sticky header or other stacking context can trap it underneath. The
  // z-index clears the walkthrough (its card is 10001); Select lists and
  // menus opened from a dialog sit above it (see the end of global.css).
  //
  // The backdrop scrolls, and the panel sits in a column at least as tall as
  // the screen that centres it and pads it by 1rem. A dialog that fits sits
  // where it always has; one taller than the screen (a phone on its side,
  // or zoomed to 200%) scrolls as a whole instead of running off both ends,
  // so its title and its buttons can always be reached. That column is the
  // backdrop a press closes the dialog on. Only the panel itself may make it
  // scroll: the column holds and clips anything positioned inside a dialog
  // (an sr-only word in a list that scrolls has escaped that list), which
  // would otherwise let a dialog that fits slide up the screen.
  return createPortal(
    <div className="fixed inset-0 z-[10050] overflow-y-auto overscroll-contain bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative flex min-h-full items-center justify-center overflow-clip p-4"
        onMouseDown={e => {
          pressedBackdropRef.current = e.target === e.currentTarget;
        }}
        onClick={handleBackdropClick}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

/**
 * The dialog panel. It is only mounted while the dialog is open, so it owns
 * everything a modal owes the keyboard: focus moves in when it appears, Tab
 * stays inside it, and focus goes back to where it was when it closes.
 * Named by the DialogTitle inside it unless `aria-label(ledby)` is passed.
 */
export const DialogContent = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const defaultTitleId = useId();
  const defaultDescriptionId = useId();
  const [titleId, setTitleId] = useState<string | null>(null);
  const [descriptionId, setDescriptionId] = useState<string | null>(null);
  // Read while rendering: by the time effects run, an autoFocus field inside
  // the panel has already taken focus from whatever opened the dialog.
  const [returnFocusTo] = useState<Element | null>(() =>
    typeof document === 'undefined' ? null : document.activeElement
  );

  const labelContext = useMemo(
    () => ({
      titleId: defaultTitleId,
      descriptionId: defaultDescriptionId,
      setTitleId,
      setDescriptionId,
    }),
    [defaultTitleId, defaultDescriptionId]
  );

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    openPanels.push(panel);

    if (!panel.contains(document.activeElement)) {
      // The control marked data-autofocus (a field to type in, or the safe
      // answer), else the first one. A dialog taller than the screen (less
      // the backdrop's 1rem padding) opens at its title, so focus starts on
      // that control only if it is on screen there too, else on the dialog
      // itself rather than below the fold; Tab then reaches its first
      // control. Never by scrolling, which would take the title away.
      const first =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        focusableIn(panel)[0];
      const tall = panel.offsetHeight > window.innerHeight - 32;
      const target =
        first && (!tall || isOnScreenAtOpen(first, panel)) ? first : panel;
      target.focus({ preventScroll: true });
    }

    const trapTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      if (openPanels[openPanels.length - 1] !== panel) return;
      const active = document.activeElement;
      const inside = active !== null && panel.contains(active);
      // A listbox or menu opened from this dialog handles its own keys.
      if (!inside && active?.closest(POPUP)) return;

      const focusable = focusableIn(panel);
      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapTab);

    return () => {
      document.removeEventListener('keydown', trapTab);
      const index = openPanels.indexOf(panel);
      if (index !== -1) openPanels.splice(index, 1);
      // Still in the page: StrictMode re-running the effect, not a close.
      if (panel.isConnected) return;
      // Give focus back, unless it has since been put somewhere on purpose.
      const active = document.activeElement;
      if (
        returnFocusTo instanceof HTMLElement &&
        returnFocusTo.isConnected &&
        (!active || active === document.body)
      ) {
        returnFocusTo.focus();
      }
    };
  }, [returnFocusTo]);

  const labelledBy =
    props['aria-labelledby'] ??
    (props['aria-label'] ? undefined : (titleId ?? undefined));
  const describedBy = props['aria-describedby'] ?? descriptionId ?? undefined;

  return (
    <DialogLabelContext.Provider value={labelContext}>
      <div
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...props}
        ref={panelRef}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        // Merged, so a caller's own width replaces the default one.
        className={cn(
          'rounded-2xl shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-200 focus:outline-none',
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </DialogLabelContext.Provider>
  );
};

export const DialogHeader = ({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={`px-6 py-5 ${className}`}>
    {children}
  </div>
);

export const DialogTitle = ({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => {
  const label = useContext(DialogLabelContext);
  const id = props.id ?? label?.titleId;
  const setTitleId = label?.setTitleId;

  useLayoutEffect(() => {
    if (!setTitleId || !id) return;
    setTitleId(id);
    return () => setTitleId(null);
  }, [setTitleId, id]);

  // A title icon sits on the first line (a 20px icon centred on the 28px
  // line), so it stays beside the start of a title that wraps.
  return (
    <h2
      {...props}
      id={id}
      className={`text-xl font-bold flex items-start gap-2 [&>svg]:mt-1 [&>svg]:shrink-0 ${className}`}
    >
      {children}
    </h2>
  );
};

export const DialogDescription = ({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  const label = useContext(DialogLabelContext);
  const id = props.id ?? label?.descriptionId;
  const setDescriptionId = label?.setDescriptionId;

  useLayoutEffect(() => {
    if (!setDescriptionId || !id) return;
    setDescriptionId(id);
    return () => setDescriptionId(null);
  }, [setDescriptionId, id]);

  return (
    <p {...props} id={id} className={`text-sm mt-1 text-balance ${className}`}>
      {children}
    </p>
  );
};

/**
 * The row of buttons that ends a dialog: the way out first, the main action
 * last. Side by side and right-aligned from `sm` up; on a phone the buttons
 * stack full-width with the main action on top.
 */
export const DialogFooter = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    {...props}
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4',
      className
    )}
  >
    {children}
  </div>
);
