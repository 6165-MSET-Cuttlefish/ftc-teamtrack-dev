import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './global.css';

// Global handlers to suppress noisy AbortError from Firebase/Fetch during HMR/navigation
if (typeof window !== 'undefined') {
  const isAbortError = (err: any): boolean => {
    if (!err) return false;
    if (err.name === 'AbortError') return true;
    if (typeof err.message === 'string' && err.message.includes('signal is aborted')) return true;
    if (typeof err === 'string' && err.includes('signal is aborted')) return true;
    return false;
  };

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    if (isAbortError(e.reason)) {
      e.preventDefault();
    }
  });

  window.addEventListener('error', (e: ErrorEvent) => {
    const err = e.error || e;
    if (isAbortError(err) || isAbortError(e.message)) {
      e.preventDefault();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
