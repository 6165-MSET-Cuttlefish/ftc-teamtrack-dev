import { lazy, type ComponentType } from 'react';

/**
 * Recovery for route chunks that fail to load.
 *
 * Every page is a separate hashed file under /assets. A tab left open across
 * a deploy asks for file names that no longer exist, and a phone that lost its
 * connection cannot fetch any of them. A reload fixes the first case (the new
 * index.html names the new files) and makes the second one worse (the browser
 * replaces the app with its own offline page), so the reload only happens
 * when the app shell is reachable, and at most once per `RELOAD_COOLDOWN_MS`
 * so a chunk that keeps failing cannot loop.
 */

/** sessionStorage key: when this tab last reloaded itself for a failed chunk */
const RELOAD_FLAG = 'teamtrack-chunk-reload';
const RELOAD_COOLDOWN_MS = 60_000;
const PROBE_TIMEOUT_MS = 5000;
/** How long a reload may take before it is treated as not happening */
const RELOAD_GRACE_MS = 10_000;
/** Same, once the user has been asked whether to leave the page */
const RELOAD_DECLINED_MS = 500;

/** The messages Chrome, Safari and Firefox (and Vite's CSS preload) use. */
const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
  'Unable to preload CSS',
];

export const isChunkLoadError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return CHUNK_ERROR_PATTERNS.some(pattern => message.includes(pattern));
};

const reloadedRecently = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG));
    return Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS;
  } catch {
    // Without sessionStorage there is no way to stop a loop, so never reload.
    return true;
  }
};

/** True when the server answers, i.e. a reload would get a page back. */
const appShellReachable = async (): Promise<boolean> => {
  if (!navigator.onLine) return false;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(import.meta.env.BASE_URL, {
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
};

/**
 * Reloads, and resolves only if the page is still here afterwards. That
 * happens when an unsaved-work prompt (the active session's `beforeunload`
 * guard) is answered with "stay": timers are frozen while the prompt is up,
 * so the short timer only runs out once the user has declined.
 */
const reloadPage = (): Promise<void> =>
  new Promise(resolve => {
    window.addEventListener(
      'beforeunload',
      event => {
        if (event.defaultPrevented || event.returnValue) {
          window.setTimeout(resolve, RELOAD_DECLINED_MS);
        }
      },
      { once: true }
    );
    window.setTimeout(resolve, RELOAD_GRACE_MS);
    window.location.reload();
  });

let pendingRecovery: Promise<void> | null = null;

/**
 * Reloads the page once to pick up a new deploy. Stays pending while the
 * reload is under way, so the caller keeps showing what it had, and resolves
 * when there is no reload and the error has to be shown instead.
 */
export const recoverFromChunkError = (): Promise<void> => {
  pendingRecovery ??= (async () => {
    if (reloadedRecently() || !(await appShellReachable())) return;
    try {
      sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    } catch {
      return;
    }
    await reloadPage();
  })().finally(() => {
    // A later failure (back online, another deploy) gets its own attempt.
    pendingRecovery = null;
  });
  return pendingRecovery;
};

/**
 * `React.lazy` for route components, with the recovery above. React caches a
 * rejected import for good, so when no reload happens the error goes to the
 * route error boundary, which offers a manual reload.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lazyWithRetry = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) =>
  lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (isChunkLoadError(error)) await recoverFromChunkError();
      throw error;
    }
  });
