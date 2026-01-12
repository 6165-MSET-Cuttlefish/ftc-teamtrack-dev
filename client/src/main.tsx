import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './global.css';

// Helper function to detect Firebase Firestore AbortError
const isFirestoreAbortError = (error: any): boolean => {
  if (!error) return false;

  // Check error name
  if (error.name === 'AbortError' || error.code === 'ERR_ABORTED') {
    return true;
  }

  // Check error message for common patterns
  const message = String(error.message || error).toLowerCase();
  if (message.includes('aborted') || message.includes('signal abort')) {
    return true;
  }

  // Check stack trace for Firebase Firestore internals
  const stack = String(error.stack || '').toLowerCase();
  if (stack.includes('firestore') && stack.includes('stream')) {
    return true;
  }

  return false;
};

// Suppress Firestore AbortError in console
const originalConsoleError = console.error;
console.error = function (...args: any[]) {
  const firstArg = args[0];
  if (isFirestoreAbortError(firstArg)) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = function (...args: any[]) {
  const firstArg = args[0];
  if (isFirestoreAbortError(firstArg)) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Suppress unhandled promise rejections from Firestore
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  if (isFirestoreAbortError(event.reason)) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
