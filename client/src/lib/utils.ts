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
    // Handle Firestore Timestamp with toDate method
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
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Check if we're in the pre-match audio intro phase (1.61s before countdown)
 * During this phase, the timer should be hidden from the user
 */
export function isInAudioIntroPhase(backendTimer: number): boolean {
  const AUDIO_INTRO_DURATION = 1.61;
  const fullStart = 163;
  const countdownBegins = fullStart - AUDIO_INTRO_DURATION; // ~161.39
  return backendTimer > countdownBegins;
}

/**
 * Calculate the user-facing timer display for Full Game matches
 * Only called when NOT in audio intro phase (intro is hidden from UI)
 * Shows countdown, autonomous, and other phases with proper formatting
 */
export function getDisplayTimer(
  backendTimer: number,
  matchPhase: string
): number {
  const COUNTDOWN_DURATION = 3;
  const AUTO_DURATION = 30;

  // Backend timer boundaries (counting DOWN from 163)
  const autoBegins = 163 - 1.61 - COUNTDOWN_DURATION; // ~158.39
  const pickupBegins = autoBegins - AUTO_DURATION; // ~128.39

  // Countdown phase (0:03, 0:02, 0:01)
  if (backendTimer > autoBegins) {
    const countdownElapsed = (163 - 1.61) - backendTimer;
    return Math.max(0, COUNTDOWN_DURATION - countdownElapsed);
  }

  // Autonomous phase (2:30 down to 2:00)
  if (matchPhase === 'auton' && backendTimer > pickupBegins) {
    const autoElapsed = autoBegins - backendTimer;
    // Show 2:30 (150s) counting down to 2:00 (120s)
    return Math.max(120, 150 - autoElapsed);
  }

  // Other phases use their own timers (phaseTimer)
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

  // Handle various error formats
  const err = error as {
    name?: string;
    code?: string;
    message?: string;
    stack?: string;
    reason?: unknown;
  };

  // Check if it's a PromiseRejectionEvent or similar
  const actualError = err.reason || error;
  const errorObj =
    typeof actualError === 'object' && actualError !== null
      ? (actualError as Record<string, unknown>)
      : {};

  const name = String(errorObj.name || '').toLowerCase();
  const code = String(errorObj.code || '').toLowerCase();
  const message = String(errorObj.message || error || '').toLowerCase();
  const stack = String(errorObj.stack || '').toLowerCase();

  // Common AbortError identifiers
  if (
    name === 'aborterror' ||
    code === 'err_aborted' ||
    code === '20' ||
    name === 'cancelederror'
  ) {
    return true;
  }

  // Specific message patterns for Firestore/Fetch aborts
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
