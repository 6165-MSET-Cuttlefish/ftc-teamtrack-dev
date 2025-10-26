import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SessionProvider } from './contexts/SessionContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { Header } from './components/Header';

// Lazy load pages for better performance
import { lazy, Suspense } from 'react';
const Original = lazy(() => import('./pages/Original'));
const Analysis = lazy(() => import('./pages/Analysis'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Profile = lazy(() => import('./pages/Profile'));
const Sessions = lazy(() => import('./pages/Sessions'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Loading component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue"></div>
  </div>
);

const App = () => (
  <TooltipProvider>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SessionProvider>
            <BrowserRouter>
              <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1">
                  <Suspense fallback={<LoadingFallback />}>
                      <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />

                        {/* Protected Routes */}
                        <Route
                          path="/"
                          element={<Navigate to="/sessions" replace />}
                        />
                        <Route
                          path="/original"
                          element={
                            <ProtectedRoute>
                              <Original />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/analysis"
                          element={
                            <ProtectedRoute>
                              <Analysis />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/profile"
                          element={
                            <ProtectedRoute>
                              <Profile />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/about" element={<About />} />
                        <Route
                          path="/sessions"
                          element={
                            <ProtectedRoute>
                              <Sessions />
                            </ProtectedRoute>
                          }
                        />

                        {/* Catch-all route */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </main>
                </div>
                <Sonner />
              </BrowserRouter>
            </SessionProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </TooltipProvider>
);

export default App;
