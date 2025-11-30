import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, ThemeProvider, SessionProvider } from '@/contexts';
import { ErrorBoundary, Header, ProtectedRoute } from '@/components';
import { ROUTES } from '@/constants';

// Lazy load pages for better performance
const Original = lazy(() => import('./pages/Original'));
const Analysis = lazy(() => import('./pages/Analysis'));
const About = lazy(() => import('./pages/About'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Profile = lazy(() => import('./pages/Profile'));
const Sessions = lazy(() => import('./pages/Sessions'));
const Compare = lazy(() => import('./pages/Compare'));
const Charts = lazy(() => import('./pages/Charts'));
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
                      <Route path={ROUTES.LOGIN} element={<Login />} />
                      <Route path={ROUTES.SIGNUP} element={<Signup />} />
                      <Route
                        path={ROUTES.FORGOT_PASSWORD}
                        element={<ForgotPassword />}
                      />
                      <Route path={ROUTES.ABOUT} element={<About />} />

                      {/* Protected Routes */}
                      <Route
                        path={ROUTES.HOME}
                        element={<Navigate to={ROUTES.SESSIONS} replace />}
                      />
                      <Route
                        path={ROUTES.ORIGINAL}
                        element={
                          <ProtectedRoute>
                            <Original />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path={ROUTES.ANALYSIS}
                        element={
                          <ProtectedRoute>
                            <Analysis />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path={ROUTES.PROFILE}
                        element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path={ROUTES.SESSIONS}
                        element={
                          <ProtectedRoute>
                            <Sessions />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path={ROUTES.COMPARE}
                        element={
                          <ProtectedRoute>
                            <Compare />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path={ROUTES.CHARTS}
                        element={
                          <ProtectedRoute>
                            <Charts />
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
