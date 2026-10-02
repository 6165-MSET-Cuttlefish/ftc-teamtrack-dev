import { useEffect, useState } from 'react';

/** How long after appearing a control ignores presses */
const ARM_DELAY_MS = 500;

/**
 * False for the first moment after the component appears, true from then on.
 *
 * For controls that show up where another button was a moment ago: the
 * second half of a double tap on that button would otherwise land on them.
 */
export const useArmed = (): boolean => {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return armed;
};
