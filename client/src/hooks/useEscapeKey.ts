import { useEffect, useRef } from 'react';

/**
 * Call `onEscape` when Escape is pressed, while `active` is true.
 *
 * Used by popups and inline confirmations so every "are you sure?" can be
 * backed out of from the keyboard. An Escape that something else already
 * handled (an open Select or menu closing itself) is left alone, so one
 * press closes one thing.
 */
export const useEscapeKey = (active: boolean, onEscape: () => void) => {
  const handlerRef = useRef(onEscape);

  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      handlerRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
};
