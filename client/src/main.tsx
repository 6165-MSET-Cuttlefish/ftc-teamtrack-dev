import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';
import { isAbortError } from '@/lib/utils';

const originalConsoleError = console.error;
console.error = function (...args: unknown[]) {
  // Only suppress abort errors, not all errors
  if (args.some(arg => isAbortError(arg))) return;

  // Also suppress specific Firebase HMR warnings
  const message = String(args[0] || '');
  if (message.includes('ResizeObserver loop') ||
      message.includes('A component is changing an uncontrolled input')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args: unknown[]) {
  // Only suppress abort-related warnings
  if (args.some(arg => isAbortError(arg))) return;
  originalConsoleWarn.apply(console, args);
};

// Suppress unhandled promise rejections from Firestore
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  if (isAbortError(event.reason)) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
