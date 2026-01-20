import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';
import { isAbortError } from '@/lib/utils';

const originalConsoleError = console.error;
console.error = function (...args: unknown[]) {
  if (isAbortError(args[0])) return;
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args: unknown[]) {
  if (isAbortError(args[0])) return;
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
