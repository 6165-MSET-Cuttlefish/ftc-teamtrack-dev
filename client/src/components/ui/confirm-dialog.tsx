import { Loader2, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

import { useTheme } from '@/contexts/ThemeContext';
import { useArmedAfterOpen } from '@/hooks/useArmedAfterOpen';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { DESTRUCTIVE_CLASS, primaryClass } from './tokens';

export interface ConfirmDialogProps {
  open: boolean;
  /** Told `false` on Cancel, Escape and a press on the backdrop (not while `busy`) */
  onOpenChange: (open: boolean) => void;
  /** The question, naming what is acted on ("Sign out and lose this session?") */
  title: ReactNode;
  /** One sentence saying what is lost or what happens next */
  description: ReactNode;
  /** Sentence case, saying what it does ("Sign out anyway", "Leave team") */
  confirmLabel: string;
  /** The safe answer ("Stay signed in"); "Cancel" unless given */
  cancelLabel?: string;
  /**
   * Goes ahead. The dialog does not close itself: the caller closes it (or
   * leaves the page) once the action is done, and keeps it open with `busy`
   * while it runs.
   */
  onConfirm: () => void;
  /**
   * `destructive` (default): going ahead throws something away, so its
   * button is the one red. `primary`: going ahead loses nothing (Make owner,
   * Switch team), so its button is the solid accent.
   */
  tone?: 'destructive' | 'primary';
  /** Shown before the title, in the tone's colour */
  icon?: LucideIcon;
  /**
   * The action is running: both buttons are disabled, the confirm button
   * spins, and Escape or the backdrop no longer close the dialog.
   */
  busy?: boolean;
  /** Holds the confirm button back (a field in `children` not filled in yet) */
  confirmDisabled?: boolean;
  /**
   * A way forward that keeps what the confirm button would throw away
   * ("Complete session and sign out"). It takes the one fill, on a row of
   * its own above [Cancel][confirm], and the confirm button turns to a red
   * outline. Held back for a moment after opening, as the confirm button is.
   */
  primaryAction?: { label: string; onSelect: () => void };
  /**
   * Fields the answer needs (a password, a typed DELETE), between the
   * question and the buttons. A field marked `data-autofocus` there takes
   * the focus from Cancel, as it comes first. Not `autoFocus`: that scrolls
   * the dialog to the field while it is still zooming in.
   */
  children?: ReactNode;
}

/**
 * Enter presses a button on every key-down, auto-repeat included: a held
 * Enter on whatever opened the dialog must not answer it too.
 */
const ignoreHeldEnter = (e: KeyboardEvent<HTMLButtonElement>) => {
  if (e.key === 'Enter' && e.repeat) e.preventDefault();
};

/**
 * Shape shared by both buttons, the same as /active's inline questions
 * (ConfirmInline). Side by side at every width: on a phone they split the
 * row equally and a long label wraps; from `sm` up they keep to one line
 * at the right.
 */
const BUTTON =
  'inline-flex flex-1 min-w-0 items-center justify-center gap-2 min-h-11 px-3 py-1.5 rounded-xl border-2 text-sm font-bold leading-tight text-center text-balance transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:flex-none sm:px-4 sm:whitespace-nowrap';

/** The ordinary choice, an outline: [light, dark themes] */
const NEUTRAL = [
  'border-gray-500 bg-transparent text-gray-800 hover:bg-gray-100',
  'border-gray-500 bg-transparent text-gray-100 hover:bg-white/10',
] as const;

/**
 * Throws something away, beside a filled way that keeps it: the red as an
 * outline (the same pairs as /active's dangerOutline), [light, dark themes]
 */
const DANGER_OUTLINE = [
  'border-red-600 bg-transparent text-red-700 hover:bg-red-50',
  'border-red-500/70 bg-transparent text-red-400 hover:bg-red-500/10',
] as const;

/**
 * The one way a page asks "are you sure?" in a modal: a question, one
 * sentence under it, and [Cancel][Confirm] in that order at every width
 * (with `primaryAction`, under a full-width button that keeps what would
 * be lost).
 *
 * The safe answer takes the focus as the dialog opens, so Enter or a second
 * tap on the spot that opened it never goes ahead. The confirm button
 * ignores presses for a moment after the dialog appears
 * (`useArmedAfterOpen`), so the second half of a double tap can't answer it
 * either. Built on the shared Dialog, which keeps Tab inside it and hands
 * focus back when it closes.
 */
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  tone = 'destructive',
  icon: Icon,
  busy = false,
  confirmDisabled = false,
  primaryAction,
  children,
}: ConfirmDialogProps) => {
  const { isDarkMode } = useTheme();
  const armed = useArmedAfterOpen(open);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasBusy = useRef(false);

  // Both buttons are disabled while it runs, which drops the focus. If the
  // dialog is still up afterwards (it failed), focus goes back: to the field
  // the error is about, else to the button that was pressed.
  useEffect(() => {
    const finished = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (!finished || !open) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const dialog = confirmRef.current?.closest('[role="alertdialog"]');
    const field = dialog?.querySelector<HTMLElement>(
      'input[aria-invalid="true"]'
    );
    (field ?? confirmRef.current)?.focus();
  }, [busy, open]);
  const iconTone =
    tone === 'primary'
      ? 'text-team-blue'
      : isDarkMode
        ? 'text-red-400'
        : 'text-red-700';

  // Under a full-width primary the pair splits its row at every width
  const pairWidth = primaryAction ? 'sm:flex-1' : undefined;
  const cancelButton = (
    <button
      type="button"
      data-autofocus
      disabled={busy}
      onKeyDown={ignoreHeldEnter}
      onClick={() => onOpenChange(false)}
      className={cn(BUTTON, pairWidth, NEUTRAL[isDarkMode ? 1 : 0])}
    >
      {cancelLabel}
    </button>
  );
  const confirmButton = (
    <button
      ref={confirmRef}
      type="button"
      disabled={busy || confirmDisabled}
      onKeyDown={ignoreHeldEnter}
      onClick={() => {
        if (!busy && armed()) onConfirm();
      }}
      className={cn(
        BUTTON,
        pairWidth,
        primaryAction
          ? DANGER_OUTLINE[isDarkMode ? 1 : 0]
          : tone === 'primary'
            ? primaryClass(isDarkMode)
            : DESTRUCTIVE_CLASS
      )}
    >
      {busy && (
        <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin" />
      )}
      {confirmLabel}
    </button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        role="alertdialog"
        aria-busy={busy || undefined}
        className={`max-w-md border ${
          isDarkMode
            ? 'bg-team-dark border-team-blue-40'
            : 'bg-white border-gray-200'
        }`}
      >
        <DialogHeader
          className={isDarkMode ? 'border-team-blue-40' : 'border-gray-200'}
        >
          <DialogTitle className={isDarkMode ? 'text-white' : 'text-gray-900'}>
            {Icon && (
              <Icon aria-hidden className={`h-5 w-5 shrink-0 ${iconTone}`} />
            )}
            <span className="min-w-0 break-words text-balance">{title}</span>
          </DialogTitle>
          <DialogDescription
            className={`text-balance ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
          >
            {description}
          </DialogDescription>
        </DialogHeader>
        {children && <div className="px-6 pt-5 pb-1">{children}</div>}
        <DialogFooter
          className={primaryAction ? 'flex-col sm:flex-col' : 'flex-row'}
        >
          {primaryAction && (
            <button
              type="button"
              disabled={busy}
              onKeyDown={ignoreHeldEnter}
              onClick={() => {
                if (!busy && armed()) primaryAction.onSelect();
              }}
              className={cn(
                BUTTON,
                'w-full flex-none',
                primaryClass(isDarkMode)
              )}
            >
              {primaryAction.label}
            </button>
          )}
          {primaryAction ? (
            <div className="flex gap-2">
              {cancelButton}
              {confirmButton}
            </div>
          ) : (
            <>
              {cancelButton}
              {confirmButton}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
