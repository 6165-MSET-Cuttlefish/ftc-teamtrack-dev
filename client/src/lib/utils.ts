import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FirebaseTimestamp, TimestampValue } from '@/types';

/** Merge Tailwind CSS classes with clsx */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert Firebase timestamp or various date formats to Date object */
export function toDate(timestamp: TimestampValue | unknown): Date {
  if (!timestamp) return new Date();

  if (timestamp instanceof Date) return timestamp;

  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }

  if (typeof timestamp === 'object' && timestamp !== null) {
    const ts = timestamp as FirebaseTimestamp;
    if ('seconds' in ts && 'nanoseconds' in ts) {
      return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
    }
    if (
      'toDate' in ts &&
      typeof (ts as { toDate: () => Date }).toDate === 'function'
    ) {
      return (ts as { toDate: () => Date }).toDate();
    }
  }

  return new Date();
}

/** Format timestamp to readable date string */
export function formatDate(
  timestamp: TimestampValue | unknown,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!timestamp) return 'Unknown date';

  const date = toDate(timestamp);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return date.toLocaleDateString('en-US', options ?? defaultOptions);
}

/** Format seconds to MM:SS string */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(s / 60);
  const remainingSeconds = s % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate the user-facing timer display for Full Game matches.
 * Timer starts at 153 and counts down with clean integer boundaries:
 *   153-151 → countdown (3, 2, 1)
 *   150-120 → autonomous (2:30 → 2:00)
 *   120-0   → teleop (2:00 → 0:00) — timer value IS the display
 */
export function getDisplayTimer(
  backendTimer: number,
  _matchPhase: string
): number {
  const COUNTDOWN_BOUNDARY = 150; // timer values above this are countdown

  // Countdown phase: timer 153→151 → display 3, 2, 1
  if (backendTimer > COUNTDOWN_BOUNDARY) {
    return backendTimer - COUNTDOWN_BOUNDARY;
  }

  // Autonomous / teleop: timer value IS the display value
  // 150 = 2:30, 120 = 2:00, 0 = 0:00
  return backendTimer;
}

/** Get initials from a name string */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

/**
 * Check if error is a Firebase Firestore AbortError
 * These commonly occur during:
 * - Hot Module Replacement (HMR) in development
 * - Component unmounting during active requests
 * - Navigation away from pages with pending Firestore queries
 * We suppress these to avoid cluttering console during development
 */
export function isAbortError(error: unknown): boolean {
  if (!error) return false;

  const err = error as {
    name?: string;
    code?: string;
    message?: string;
    stack?: string;
    reason?: unknown;
  };

  const actualError = err.reason || error;
  const errorObj =
    typeof actualError === 'object' && actualError !== null
      ? (actualError as Record<string, unknown>)
      : {};

  const name = String(errorObj.name || '').toLowerCase();
  const code = String(errorObj.code || '').toLowerCase();
  const message = String(errorObj.message || error || '').toLowerCase();
  const stack = String(errorObj.stack || '').toLowerCase();

  if (
    name === 'aborterror' ||
    code === 'err_aborted' ||
    code === '20' ||
    name === 'cancelederror'
  ) {
    return true;
  }

  if (
    message.includes('aborted') ||
    message.includes('signal abort') ||
    message.includes('signal is aborted') ||
    message.includes('request was aborted') ||
    message.includes('user aborted')
  ) {
    return true;
  }

  // Check stack trace for Firebase Firestore internal stream closure
  if (
    stack.includes('firestore') &&
    (stack.includes('stream') || stack.includes('abort'))
  ) {
    return true;
  }

  return false;
}

/** Get human-readable error message from unknown error type */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}
