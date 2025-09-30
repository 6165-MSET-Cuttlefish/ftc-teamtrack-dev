/**
 * Centralized logging utility for consistent error handling
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  user?: string;
  action?: string;
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.isDevelopment && level === 'debug') {
      return; // Skip debug logs in production
    }

    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${JSON.stringify(context)}]` : '';
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;

    // Only log in development mode to avoid console statements in production
    if (process.env.NODE_ENV === 'development') {
      switch (level) {
        case 'error':
          console.error(logMessage);
          break;
        case 'warn':
          console.warn(logMessage);
          break;
        case 'info':
          console.info(logMessage);
          break;
        case 'debug':
          console.log(logMessage);
          break;
      }
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    this.log('error', message, errorContext);
  }

  // Development-only logging
  devOnly(callback: () => void) {
    if (this.isDevelopment) {
      callback();
    }
  }
}

export const logger = new Logger();

// Utility functions for common logging scenarios
export const logApiError = (endpoint: string, error: unknown) => {
  logger.error(`API call failed for ${endpoint}`, error, { 
    type: 'api_error',
    endpoint 
  });
};

export const logAuthEvent = (event: string, success: boolean, error?: unknown) => {
  if (success) {
    logger.info(`Authentication ${event} successful`, { type: 'auth', event });
  } else {
    logger.error(`Authentication ${event} failed`, error, { type: 'auth', event });
  }
};

export const logComponentError = (component: string, error: unknown) => {
  logger.error(`Component error in ${component}`, error, { 
    type: 'component_error',
    component 
  });
};