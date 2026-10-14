import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';
import { isAbortError, getFirebase } from '@/lib';
import { isChunkLoadError, recoverFromChunkError } from '@/lib/lazyWithRetry';

// Initialize Firebase eagerly on page load
getFirebase();

if (import.meta.env.DEV) {
  const originalConsoleError = console.error;
  console.error = function (...args: unknown[]) {
    if (args.some(arg => isAbortError(arg))) return;
    const message = String(args[0] || '');
    if (
      message.includes('ResizeObserver loop') ||
      message.includes('A component is changing an uncontrolled input')
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = function (...args: unknown[]) {
    if (args.some(arg => isAbortError(arg))) return;
    originalConsoleWarn.apply(console, args);
  };
}

window.addEventListener(
  'unhandledrejection',
  (event: PromiseRejectionEvent) => {
    if (isAbortError(event.reason)) {
      event.preventDefault();
    }
  }
);

// Vite fires this when a lazy chunk or its CSS fails to load, which after a
// deploy means this tab is still running the previous build. Route chunks are
// also covered by lazyWithRetry; this catches every other dynamic import.
window.addEventListener('vite:preloadError', event => {
  if (isChunkLoadError(event.payload)) void recoverFromChunkError();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
