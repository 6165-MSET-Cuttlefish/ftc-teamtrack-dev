import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
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

/** Open dialog panels, outermost first: only the last one traps Tab */
const openPanels: HTMLElement[] = [];

/** The page scrolls again once the last open dialog closes */
let scrollLocks = 0;
let overflowBeforeLock = '';

const lockScroll = () => {
  if (scrollLocks === 0) {
    overflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
};

const unlockScroll = () => {
  scrollLocks -= 1;
  if (scrollLocks === 0) {
    document.body.style.overflow = overflowBeforeLock;
  }
};

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
  useEscapeKey(open, () => onOpenChange?.(false));
  /** A click only dismisses if it also started on the backdrop (not a text-selection drag) */
  const pressedBackdropRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    const pressedBackdrop = pressedBackdropRef.current;
    pressedBackdropRef.current = false;
    if (e.target === e.currentTarget && pressedBackdrop && onOpenChange) {
      onOpenChange(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onMouseDown={e => {
        pressedBackdropRef.current = e.target === e.currentTarget;
      }}
      onClick={handleBackdropClick}
    >
      {children}
    </div>
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
      const target =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        focusableIn(panel)[0] ??
        panel;
      target.focus();
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
  <div {...props} className={`px-6 py-5 border-b ${className}`}>
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

  return (
    <h2
      {...props}
      id={id}
      className={`text-xl font-bold flex items-center gap-2 ${className}`}
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
    <p {...props} id={id} className={`text-sm mt-1 ${className}`}>
      {children}
    </p>
  );
};
