import { Loader2, type LucideIcon } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';

import { useTheme } from '@/contexts/ThemeContext';
import { useArmedAfterOpen } from '@/hooks/useArmedAfterOpen';
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
   * Fields the answer needs (a password, a typed DELETE), between the
   * question and the buttons. An `autoFocus` field there takes the focus
   * from Cancel.
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
 * The one way a page asks "are you sure?" in a modal: a question, one
 * sentence under it, and [Cancel][Confirm] in that order at every width.
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
  children,
}: ConfirmDialogProps) => {
  const { isDarkMode } = useTheme();
  const armed = useArmedAfterOpen(open);
  const iconTone =
    tone === 'primary'
      ? 'text-team-blue'
      : isDarkMode
        ? 'text-red-400'
        : 'text-red-700';

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
        <DialogFooter className="flex-row">
          <button
            type="button"
            data-autofocus
            disabled={busy}
            onKeyDown={ignoreHeldEnter}
            onClick={() => onOpenChange(false)}
            className={`${BUTTON} ${NEUTRAL[isDarkMode ? 1 : 0]}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy || confirmDisabled}
            onKeyDown={ignoreHeldEnter}
            onClick={() => {
              if (!busy && armed()) onConfirm();
            }}
            className={`${BUTTON} ${
              tone === 'primary' ? primaryClass(isDarkMode) : DESTRUCTIVE_CLASS
            }`}
          >
            {busy && (
              <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin" />
            )}
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
