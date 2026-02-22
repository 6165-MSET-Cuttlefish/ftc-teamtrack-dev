import { isAbortError } from './utils';

const isDevelopment = (): boolean => import.meta.env.DEV;

function formatLog(
  level: string,
  message: string,
  context?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  let output = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (context && Object.keys(context).length > 0) {
    output += ` ${JSON.stringify(context)}`;
  }
  return output;
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    // eslint-disable-next-line no-console
    console.log(formatLog('info', message, context));
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    if (isAbortError(message) || isAbortError(context)) return;
    console.warn(formatLog('warn', message, context));
  },

  error: (
    message: string,
    error?: unknown,
    context?: Record<string, unknown>
  ) => {
    if (isAbortError(error) || isAbortError(message)) return;
    const errorContext: Record<string, unknown> = {
      ...context,
      errorMessage: error instanceof Error ? error.message : String(error),
      // Only include stack traces in development to avoid leaking internals
      ...(isDevelopment() && error instanceof Error ? { errorStack: error.stack } : {}),
    };
    console.error(formatLog('error', message, errorContext));
  },

  debug: (message: string, context?: Record<string, unknown>) => {
    if (isDevelopment()) {
      // eslint-disable-next-line no-console
      console.debug(formatLog('debug', message, context));
    }
  },
};
