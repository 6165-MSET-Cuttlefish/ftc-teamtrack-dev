/**
 * How long this browser keeps what a guest saves in it.
 *
 * A guest's sessions live only in this browser's storage. Safari erases a
 * site's storage after seven days of use without visiting it (an app added
 * to the Home Screen keeps its own), so a team that practises once a week
 * can lose a season: the guest is told, and the browser is asked to keep
 * the storage where it can be.
 */

/**
 * Safari on an iPhone, iPad or Mac, outside a Home Screen app: where an
 * unvisited site's storage is erased after a week.
 */
export const safariMayEraseStorage = (): boolean => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true;
  if (standalone) return false;
  const ua = navigator.userAgent;
  // An iPad's Safari says it is a Mac.
  const apple = /iPhone|iPad|iPod|Macintosh/.test(ua);
  const safari =
    /AppleWebKit/.test(ua) &&
    /Safari\//.test(ua) &&
    !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|OPiOS|OPR|GSA|Firefox|Android/.test(
      ua
    );
  return apple && safari;
};

let persistenceAsked = false;

/**
 * Ask the browser, once per visit, to keep this site's storage rather than
 * clear it under pressure. Where it isn't offered, nothing happens; where
 * it is already granted, it isn't asked again.
 */
export const requestPersistentStorage = (): void => {
  if (persistenceAsked || typeof navigator === 'undefined') return;
  persistenceAsked = true;
  const storage = navigator.storage;
  if (!storage?.persist || !storage.persisted) return;
  void storage
    .persisted()
    .then(persisted => (persisted ? persisted : storage.persist()))
    .catch(() => {
      /* not granted: the copy has already said what that means */
    });
};
