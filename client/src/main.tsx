import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './global.css';

// Global handlers to suppress noisy AbortError from Firebase/Fetch during HMR/navigation
if (typeof window !== 'undefined') {
  const isAbortError = (err: any): boolean => {
    if (!err) return false;

    // Check error name
    if (err.name === 'AbortError') return true;
    if (err.code === 'ERR_ABORTED') return true;

    // Check message property
    if (err.message) {
      const msg = String(err.message).toLowerCase();
      if (msg.includes('aborted') || msg.includes('abort') || msg.includes('signal is aborted')) {
        return true;
      }
    }

    // Check toString representation
    const str = String(err).toLowerCase();
    if (str.includes('aborterror') || str.includes('signal is aborted')) {
      return true;
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

  console.warn = function(...args: any[]) {
    if (args.some(arg => isAbortError(arg))) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = function(...args: any[]) {
    if (args.some(arg => isAbortError(arg))) {
      return;
    }
    originalError.apply(console, args);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
