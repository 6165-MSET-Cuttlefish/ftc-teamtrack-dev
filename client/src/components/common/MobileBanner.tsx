import { useState, useEffect } from 'react';
import { Monitor, X } from 'lucide-react';

const STORAGE_KEY = 'teamtrack-mobile-banner-dismissed';

/**
 * A dismissible banner shown only on small screens (< 768 px)
 * warning that TeamTrack is designed for desktop use.
 * Dismissal is remembered in localStorage for 7 days.
 */
export const MobileBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show on narrow viewports
    if (window.innerWidth >= 768) return;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const expiry = Number(raw);
      if (Date.now() < expiry) return; // still within dismiss window
    }

    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    // Remember dismissal for 7 days
    localStorage.setItem(STORAGE_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  return (
    <div className="relative isolate flex items-center gap-x-3 overflow-hidden bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-amber-900 sm:px-6 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200">
      <Monitor className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p className="text-xs leading-snug sm:text-sm">
        <strong className="font-semibold">Heads up:</strong> TeamTrack is built for desktop.
        Some features may not work as expected on mobile devices. Mobile support is planned for a future update.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="ml-auto -m-1.5 p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        aria-label="Dismiss mobile warning"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
