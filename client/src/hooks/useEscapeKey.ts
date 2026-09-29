import { useEffect, useRef } from 'react';

/**
 * Call `onEscape` when Escape is pressed, while `active` is true.
 *
 * Used by popups and inline confirmations so every "are you sure?" can be
 * backed out of from the keyboard.
 */
export const useEscapeKey = (active: boolean, onEscape: () => void) => {
  const handlerRef = useRef(onEscape);

  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handlerRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
};
