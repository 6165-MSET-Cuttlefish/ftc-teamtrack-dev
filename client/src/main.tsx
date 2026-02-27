import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';
import { isAbortError, getFirebase } from '@/lib';

// Initialize Firebase (including Analytics) eagerly on page load
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
