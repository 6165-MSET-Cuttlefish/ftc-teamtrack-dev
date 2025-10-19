import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './global.css';

// Global handlers to suppress noisy AbortError from Firebase/Fetch during HMR/navigation
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const reason: any = e.reason;
    if (!reason) return;
    if (
      reason.name === 'AbortError' ||
      (typeof reason === 'string' && reason.includes('signal is aborted'))
    ) {
      e.preventDefault();
      return;
    }
  });

  window.addEventListener('error', (e: ErrorEvent) => {
    const err: any = (e && (e as any).error) || null;
    if (err && err.name === 'AbortError') {
      e.preventDefault();
      return;
    }
    if (
      typeof e.message === 'string' &&
      e.message.includes('signal is aborted')
    ) {
      e.preventDefault();
      return;
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
