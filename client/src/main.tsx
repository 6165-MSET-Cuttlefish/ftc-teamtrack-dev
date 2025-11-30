import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './global.css';

// Global handlers to suppress noisy AbortError from Firebase/Fetch during HMR/navigation
if (typeof window !== 'undefined') {
  const isAbortError = (err: unknown): boolean => {
    if (!err) return false;

    // Check error name
    if (typeof err === 'object' && 'name' in err && err.name === 'AbortError')
      return true;
    if (typeof err === 'object' && 'code' in err && err.code === 'ERR_ABORTED')
      return true;

    // Check message property
    if (
      typeof err === 'object' &&
      'message' in err &&
      typeof err.message === 'string'
    ) {
      const msg = err.message.toLowerCase();
      if (
        msg.includes('aborted') ||
        msg.includes('abort') ||
        msg.includes('signal is aborted') ||
        msg.includes('signal abort')
      ) {
        return true;
      }
    }

    // Check toString representation
    const str = String(err).toLowerCase();
    if (
      str.includes('aborterror') ||
      str.includes('signal is aborted') ||
      str.includes('signal abort')
    ) {
      return true;
    }

    // Check stack traces
    if (
      typeof err === 'object' &&
      'stack' in err &&
      typeof err.stack === 'string'
    ) {
      const stack = err.stack.toLowerCase();
      if (
        stack.includes('aborterror') ||
        stack.includes('signal is aborted') ||
        stack.includes('signal abort')
      ) {
        return true;
      }
    }

    return false;
  };

  // Suppress unhandled promise rejections
  const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
    if (isAbortError(e.reason)) {
      e.preventDefault();
    }
  };
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // Suppress errors
  const handleError = (e: ErrorEvent) => {
    const err = e.error || e;
    if (isAbortError(err) || isAbortError(e.message)) {
      e.preventDefault();
    }
  };
  window.addEventListener('error', handleError);

  // Suppress AbortError from being thrown to console

  const originalWarn = console.warn;
  const originalError = console.error;
  // eslint-disable-next-line no-console
  const originalLog = console.log;

  const shouldSuppressError = (...args: unknown[]): boolean => {
    return args.some(arg => {
      if (isAbortError(arg)) return true;
      // Also check stringified versions for Firebase errors that might not have proper name
      if (typeof arg === 'string' && arg.includes('signal is aborted'))
        return true;
      // Check error stack traces
      if (
        arg &&
        typeof arg === 'object' &&
        'stack' in arg &&
        typeof arg.stack === 'string'
      ) {
        const stack = arg.stack.toLowerCase();
        if (stack.includes('aborterror') || stack.includes('signal is aborted'))
          return true;
      }
      return false;
    });
  };

  console.warn = function (...args: unknown[]) {
    if (shouldSuppressError(...args)) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = function (...args: unknown[]) {
    if (shouldSuppressError(...args)) {
      return;
    }
    originalError.apply(console, args);
  };

  // eslint-disable-next-line no-console
  console.log = function (...args: unknown[]) {
    if (shouldSuppressError(...args)) {
      return;
    }
    originalLog.apply(console, args);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
