import { FIREBASE_CONFIG } from '@/constants';

/**
 * Google Analytics through gtag.js itself, not the Firebase SDK. The SDK asks
 * Firebase for the measurement ID when it starts and sends to whatever comes
 * back, and for this app that answer leaves the ID out even though the
 * project is linked to Analytics, so nothing was ever recorded. The ID the
 * build was given goes to the same Analytics property.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GTAG_URL = 'https://www.googletagmanager.com/gtag/js';

let gtag: ((...args: unknown[]) => void) | null | undefined;

/** gtag, set up on first use; null when this build has no measurement ID */
const ready = () => {
  if (gtag !== undefined) return gtag;
  const id = FIREBASE_CONFIG.measurementId;
  if (!id) return (gtag = null);
  const dataLayer = (window.dataLayer ??= []);
  // gtag.js only reads the arguments object itself, not an array of them.
  window.gtag ??= function () {
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
  gtag = window.gtag;
  gtag('js', new Date());
  // `RouteTracker` sends every page_view, the first one included.
  gtag('config', id, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `${GTAG_URL}?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  return gtag;
};

export const logPageView = (params: {
  page_path: string;
  page_location: string;
}) => {
  ready()?.('event', 'page_view', params);
};
