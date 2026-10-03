import { useEffect, useRef, useState, type RefObject } from 'react';
import { toast, useSonner, type ToastT } from 'sonner';

/** How long Sonner shows a toast that names no duration of its own */
const SONNER_DEFAULT_DURATION = 4000;

/**
 * The least a toast that was hidden behind newer ones gets once it is in
 * view again: time to read it and reach its button.
 */
const MIN_TIME_ON_RETURN = 3000;

type ToastId = ToastT['id'];

interface Countdown {
  /** The toast as last seen, whose `onAutoClose` runs when it runs out */
  toast: ToastT;
  /** Its whole lifetime, which it gets again when it moves to another list */
  duration: number;
  /** Time left on it as of its last stop */
  left: number;
  /** When it last started counting (performance.now()), null while stopped */
  since: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  /** The list it is shown in */
  position: string;
  /** Stopped because newer toasts hid it */
  hidden: boolean;
  /** Not yet seen again since Sonner was told to stop timing it */
  handedOver: boolean;
  /** Ran out, and is on its way out */
  closed: boolean;
}

/** Whether Sonner has the toasts spread out under the pointer or a finger */
const useToastsExpanded = (sectionRef: RefObject<HTMLElement | null>) => {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const check = () =>
      setExpanded(
        section.querySelector(
          '[data-sonner-toast][data-expanded="true"]:not([data-removed="true"])'
        ) !== null
      );
    const observer = new MutationObserver(check);
    observer.observe(section, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-expanded', 'data-removed'],
    });
    check();
    return () => observer.disconnect();
  }, [sectionRef]);
  return expanded;
};

/**
 * Times every toast that has a button to press (Undo above all) in place of
 * Sonner, which counts a toast down from the moment it appears, seen or not.
 * Only the newest `visibleToasts` toasts of a list are shown, one on a
 * phone: an Undo that a newer toast hid ran out unseen there, and the
 * session delete it held back went through behind it.
 *
 * Here such a toast counts down only while it is in view and the toasts are
 * not spread out under the pointer (where Sonner pauses its own). Hidden, it
 * waits, and comes back with the time it had left once the toasts in front
 * of it have gone. Running out closes it as Sonner would, `onAutoClose`
 * first, so whatever its button can still take back is only done for good
 * once it has actually been on screen for its whole time. Sonner's own timer
 * is switched off by showing the toast again with no end.
 *
 * `sectionRef` is the Toaster's own element; `position` the list a toast
 * that names none goes to.
 */
export const useToastCountdowns = ({
  sectionRef,
  position,
  visibleToasts,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  position: string;
  visibleToasts: number;
}) => {
  const { toasts } = useSonner();
  const expanded = useToastsExpanded(sectionRef);
  const countdownsRef = useRef(new Map<ToastId, Countdown>());
  /**
   * The lifetime of every toast timed here, by id. Sonner remembers a
   * toast's options under its id after it has gone, and a toast shown again
   * under that id without a duration of its own takes the stored one: the
   * "no end" set here. It is timed with its first lifetime instead.
   */
  const lifetimesRef = useRef(new Map<ToastId, number>());

  useEffect(() => {
    const countdowns = countdownsRef.current;
    const lifetimes = lifetimesRef.current;
    const now = performance.now();

    const stop = (countdown: Countdown) => {
      if (countdown.since === null) return;
      countdown.left -= now - countdown.since;
      countdown.since = null;
      if (countdown.timer) clearTimeout(countdown.timer);
      countdown.timer = null;
    };

    const run = (countdown: Countdown) => {
      if (countdown.since !== null || countdown.closed) return;
      if (countdown.hidden) {
        countdown.hidden = false;
        countdown.left = Math.max(countdown.left, MIN_TIME_ON_RETURN);
      }
      countdown.since = now;
      countdown.timer = setTimeout(
        () => {
          countdown.timer = null;
          countdown.closed = true;
          countdown.toast.onAutoClose?.(countdown.toast);
          toast.dismiss(countdown.toast.id);
        },
        Math.max(countdown.left, 0)
      );
    };

    const begin = (item: ToastT, list: string, duration: number) => {
      const previous = countdowns.get(item.id);
      if (previous?.timer) clearTimeout(previous.timer);
      const countdown: Countdown = {
        toast: item,
        duration,
        left: duration,
        since: null,
        timer: null,
        position: list,
        hidden: false,
        closed: false,
        handedOver: false,
      };
      countdowns.set(item.id, countdown);
      return countdown;
    };

    const seen = new Set<ToastId>();
    /** How many toasts each list has above the one being looked at */
    const above = new Map<string, number>();
    for (const item of toasts) {
      const list = item.position ?? position;
      const index = above.get(list) ?? 0;
      above.set(list, index + 1);

      let countdown = countdowns.get(item.id);
      const shownAgain = countdown?.toast !== item;
      let fresh = true;
      if (
        shownAgain &&
        item.action &&
        item.duration !== Infinity &&
        item.type !== 'loading'
      ) {
        // New, or shown again with a lifetime of its own: timed from now.
        const duration = item.duration || SONNER_DEFAULT_DURATION;
        lifetimes.set(item.id, duration);
        countdown = begin(item, list, duration);
        if (toast.getToasts().some(open => open.id === item.id)) {
          countdown.handedOver = true;
          toast.message(item.title, { id: item.id, duration: Infinity });
        }
      } else if (!countdown) {
        const duration = lifetimes.get(item.id);
        if (duration === undefined || item.duration !== Infinity) continue;
        countdown = begin(item, list, duration);
      } else {
        fresh = false;
      }

      // Seen again after the hand-over, it goes on. Shown again by the app,
      // or moved to another list, it starts over, as Sonner's own toasts do.
      let restart = countdown.position !== list;
      if (!fresh && shownAgain) {
        if (countdown.handedOver) countdown.handedOver = false;
        else restart = true;
      }
      if (restart) {
        stop(countdown);
        countdown.position = list;
        countdown.left = countdown.duration;
      }
      countdown.toast = item;
      seen.add(item.id);
      if (index >= visibleToasts) {
        stop(countdown);
        countdown.hidden = true;
      } else if (expanded) {
        stop(countdown);
      } else {
        run(countdown);
      }
    }

    for (const [id, countdown] of countdowns) {
      if (seen.has(id)) continue;
      if (countdown.timer) clearTimeout(countdown.timer);
      countdowns.delete(id);
    }
  }, [toasts, expanded, position, visibleToasts]);

  useEffect(() => {
    const countdowns = countdownsRef.current;
    return () => {
      countdowns.forEach(countdown => {
        if (countdown.timer) clearTimeout(countdown.timer);
      });
      countdowns.clear();
    };
  }, []);
};
