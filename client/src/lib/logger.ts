import { isAbortError } from './utils';

/**
 * Centralized logging utility for the application
 * Allows for easier debugging and future integration with analytics/error reporting
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// Store logs in memory for debugging (max 100 entries)
const logBuffer: LogEntry[] = [];
const MAX_LOG_ENTRIES = 100;

// Check if running in development mode
const isDevelopment = (): boolean => {
  try {
    return typeof window !== 'undefined' && ((window as unknown as Record<string, unknown>).__DEV__ as boolean) !== false;
  } catch {
    return true; // Default to true for safety
  }
};

function addToBuffer(entry: LogEntry) {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }
}

function formatLog(level: LogLevel, message: string, context?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  let output = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (context && Object.keys(context).length > 0) {
    output += ` ${JSON.stringify(context)}`;
  }
  return output;
}

export const logger = {
  /**
   * Log informational messages
   */
  info: (message: string, context?: Record<string, unknown>) => {
    const entry: LogEntry = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      context,
    };
    addToBuffer(entry);
    // eslint-disable-next-line no-console
    console.log(formatLog('info', message, context));
  },

  /**
   * Log warnings
   */
  warn: (message: string, context?: Record<string, unknown>) => {
    // Suppress abort errors from logs
    if (isAbortError(message) || isAbortError(context)) return;

    const entry: LogEntry = {
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      context,
    };
    addToBuffer(entry);
    console.warn(formatLog('warn', message, context));
  },

  /**
   * Log errors - primary method for error logging
   */
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    // Suppress abort errors from logs to avoid cluttering error tracking
    if (isAbortError(error) || isAbortError(message)) return;

    const errorContext: Record<string, unknown> = {
      ...context,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    };

    const entry: LogEntry = {
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      context: errorContext,
    };
    addToBuffer(entry);
    console.error(formatLog('error', message, errorContext));
  },

  /**
   * Log debug information
   */
  debug: (message: string, context?: Record<string, unknown>) => {
    // Only log debug in development
    if (isDevelopment()) {
      const entry: LogEntry = {
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        context,
      };
      addToBuffer(entry);
      // eslint-disable-next-line no-console
      console.debug(formatLog('debug', message, context));
    }
  },

  /**
   * Get recent logs for debugging
   */
  getRecentLogs: (count: number = 20): LogEntry[] => {
    return logBuffer.slice(Math.max(0, logBuffer.length - count));
  },

  /**
   * Clear log buffer
   */
  clear: () => {
    logBuffer.length = 0;
  },
};
