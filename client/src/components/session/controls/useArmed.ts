import { useEffect, useState } from 'react';

/** How long after appearing a control ignores presses */
const ARM_DELAY_MS = 500;

/** What nothing is armed for yet */
const UNARMED = Symbol('unarmed');

/**
 * False for the first moment after the component appears, true from then on.
 *
 * For controls that show up where another button was a moment ago: the
 * second half of a double tap on that button would otherwise land on them.
 *
 * A control that changes what it does in place passes what it does now as
 * `key`: from the render that changes it, it is unarmed again for `delayMs`.
 */
export const useArmed = (
  delayMs: number = ARM_DELAY_MS,
  key: unknown = null
): boolean => {
  const [armedFor, setArmedFor] = useState<unknown>(UNARMED);
  useEffect(() => {
    const timer = setTimeout(() => setArmedFor(key), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, key]);
  return armedFor === key;
};
