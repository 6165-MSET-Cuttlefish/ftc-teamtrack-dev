/**
 * Cookie-based storage utilities for guest users
 * Uses cookies to persist session data for guests across browser sessions
 */

const COOKIE_PREFIX = 'teamtrack_guest_';
const COOKIE_EXPIRY_DAYS = 30; // Keep guest data for 30 days

interface CookieOptions {
  expires?: number; // Days until expiration
  path?: string;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
}

/**
 * Set a cookie with the given name and value
 */
export const setCookie = (
  name: string,
  value: string,
  options: CookieOptions = {}
): void => {
  const {
    expires = COOKIE_EXPIRY_DAYS,
    path = '/',
    sameSite = 'Lax',
    secure = window.location.protocol === 'https:',
  } = options;

  const expiryDate = new Date();
  expiryDate.setTime(expiryDate.getTime() + expires * 24 * 60 * 60 * 1000);

  const cookieParts = [
    `${encodeURIComponent(COOKIE_PREFIX + name)}=${encodeURIComponent(value)}`,
    `expires=${expiryDate.toUTCString()}`,
    `path=${path}`,
    `SameSite=${sameSite}`,
  ];

  if (secure) {
    cookieParts.push('Secure');
  }

  document.cookie = cookieParts.join('; ');
};

/**
 * Get a cookie value by name
 */
export const getCookie = (name: string): string | null => {
  const cookieName = encodeURIComponent(COOKIE_PREFIX + name);
  const cookies = document.cookie.split(';');

  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(cookieName + '=')) {
      return decodeURIComponent(cookie.substring(cookieName.length + 1));
    }
  }

  return null;
};

/**
 * Delete a cookie by name
 */
export const deleteCookie = (name: string, path: string = '/'): void => {
  document.cookie = `${encodeURIComponent(COOKIE_PREFIX + name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
};

/**
 * Save guest session data to cookies
 * For large data, we'll compress and split across multiple cookies if needed
 */
export const saveGuestSessionData = (
  sessionId: string,
  data: Record<string, any>
): void => {
  try {
    const jsonData = JSON.stringify(data);
    
    // Cookies have a size limit (~4KB), so for simplicity we'll use localStorage
    // as the primary storage and cookies as a flag
    localStorage.setItem(`${COOKIE_PREFIX}session_${sessionId}`, jsonData);
    
    // Set a cookie to indicate this guest has data
    setCookie('has_data', 'true');
  } catch (error) {
    console.error('Failed to save guest session data:', error);
  }
};

/**
 * Load guest session data from cookies
 */
export const loadGuestSessionData = (
  sessionId: string
): Record<string, any> | null => {
  try {
    const hasData = getCookie('has_data');
    if (!hasData) return null;

    const jsonData = localStorage.getItem(`${COOKIE_PREFIX}session_${sessionId}`);
    if (!jsonData) return null;

    return JSON.parse(jsonData);
  } catch (error) {
    console.error('Failed to load guest session data:', error);
    return null;
  }
};

/**
 * Clear all guest session data
 */
export const clearGuestSessionData = (): void => {
  // Clear all localStorage items with our prefix
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(COOKIE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });

  // Clear the has_data cookie
  deleteCookie('has_data');
};

/**
 * List all guest session IDs
 */
export const listGuestSessions = (): string[] => {
  const hasData = getCookie('has_data');
  if (!hasData) return [];

  const keys = Object.keys(localStorage);
  const sessionIds: string[] = [];

  keys.forEach(key => {
    if (key.startsWith(`${COOKIE_PREFIX}session_`)) {
      const sessionId = key.replace(`${COOKIE_PREFIX}session_`, '');
      sessionIds.push(sessionId);
    }
  });

  return sessionIds;
};
