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
    if ('toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
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

/** Get initials from a name string */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

/** Check if error is a Firebase Firestore AbortError (commonly occurs during HMR/navigation) */
export function isAbortError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === 'object' && error !== null) {
    const err = error as { name?: string; code?: string; message?: string; stack?: string };
    
    // Check error name
    if (err.name === 'AbortError' || err.code === 'ERR_ABORTED') {
      return true;
    }

    // Check error message for common patterns
    const message = String(err.message || '').toLowerCase();
    if (message.includes('aborted') || message.includes('signal abort') || message.includes('signal')) {
      return true;
    }

    // Check stack trace for Firebase Firestore internals
    const stack = String(err.stack || '').toLowerCase();
    if (stack.includes('firestore') && stack.includes('stream')) {
      return true;
    }
  }

  return false;
}

/** Safely handle async operations with abort error suppression */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isAbortError(error)) {
      return fallback;
    }
    throw error;
  }
}

/** Calculate percentage change between two values */
export function calculatePercentChange(current: number, baseline: number): number {
  if (baseline === 0) return current > 0 ? 100 : 0;
  return ((current - baseline) / baseline) * 100;
}

/** Calculate average of an array of numbers */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}
