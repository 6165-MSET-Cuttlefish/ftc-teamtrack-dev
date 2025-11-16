import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './global.css';

// Global handlers to suppress noisy AbortError from Firebase/Fetch during HMR/navigation
if (typeof window !== 'undefined') {
  const isAbortError = (err: any): boolean => {
    if (!err) return false;
    if (err.name === 'AbortError') return true;
    if (err.code === 'ERR_ABORTED') return true;
    if (typeof err.message === 'string') {
      const msg = err.message.toLowerCase();
      return msg.includes('aborted') || msg.includes('abort');
    }
    if (typeof err === 'string') {
      const msg = err.toLowerCase();
      return msg.includes('aborted') || msg.includes('abort');
    }
    return false;
  };

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    if (isAbortError(e.reason)) {
      e.preventDefault();
    }
  }, true);

  // Capture errors in the capture phase to catch them early
  window.addEventListener('error', (e: ErrorEvent) => {
    const err = e.error || e;
    if (isAbortError(err) || isAbortError(e.message)) {
      e.preventDefault();
    }
  }, true);

  // Also suppress AbortError when logged via console
  const originalError = console.error;
  console.error = function(...args: any[]) {
    if (args.length > 0 && isAbortError(args[0])) {
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
