import { useEffect, useState } from 'react';

/**
 * "Press Start first". Before Start, the controls a match will use look
 * ready, but there is no match to put a tap in yet: such a tap asks the
 * Start button to draw the eye instead of doing nothing without a word.
 */
const listeners = new Set<() => void>();

/** Ask the Start button to show it is the next step */
export const requestStartNudge = (): void => {
  listeners.forEach(listener => listener());
};

/**
 * How many times Start has been asked for, from 0. A Start button keys its
 * pulse (and its "Press Start first" note) to it, so each tap replays it.
 */
export const useStartNudge = (): number => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const listener = () => setCount(n => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return count;
};
