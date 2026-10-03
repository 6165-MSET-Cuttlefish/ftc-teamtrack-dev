import { useLayoutEffect, useRef } from 'react';

/**
 * Publishes the site header's height as `--header-h` on the layout root, so
 * whatever is pinned inside the layout can stop below the header instead of
 * sliding underneath it. Measured rather than hard-coded because the header
 * changes height with the breakpoint.
 */
export const useHeaderHeightVar = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const header = document.querySelector('header');
    if (!root || !header) return;

    const publish = () =>
      root.style.setProperty('--header-h', `${header.offsetHeight}px`);
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return rootRef;
};
