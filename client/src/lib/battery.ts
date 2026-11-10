/**
 * Battery voltage: read off the Driver Hub before a match and kept on the
 * match, so accuracy can be seen against it (Analysis → Summary).
 *
 * Whether it is asked for is a setting of this device, turned on and off in
 * the session menu: a team that tracks it tracks it in every session.
 */

import { useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '@/constants';

/** Readings outside this are typos: a 12 V robot battery is never near them */
export const BATTERY_MIN_V = 5;
export const BATTERY_MAX_V = 20;

/** A stored or typed voltage that makes sense, to 2 decimals; else null */
export const toBatteryVoltage = (value: unknown): number | null => {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value.trim().replace(',', '.'))
        : NaN;
  if (!Number.isFinite(n) || n < BATTERY_MIN_V || n > BATTERY_MAX_V)
    return null;
  return Math.round(n * 100) / 100;
};

/** "12.8 V" */
export const formatVoltage = (volts: number): string => `${volts} V`;

const CHANGE_EVENT = 'teamtrack-record-battery';

const read = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEYS.RECORD_BATTERY) === 'true';
  } catch {
    return false;
  }
};

/** Turn asking for battery voltage on or off on this device */
export const setRecordBattery = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(STORAGE_KEYS.RECORD_BATTERY, 'true');
    else localStorage.removeItem(STORAGE_KEYS.RECORD_BATTERY);
  } catch {
    /* storage unavailable: nothing to remember it in */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab turned it on or off
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

/** Whether this device asks for battery voltage, kept current as it changes */
export const useRecordBattery = (): boolean =>
  useSyncExternalStore(subscribe, read, () => false);
