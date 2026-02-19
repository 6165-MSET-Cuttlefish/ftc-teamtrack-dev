import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, ThemeProvider, SessionProvider } from '@/contexts';
import {
  ErrorBoundary,
  Header,
  ProtectedRoute,
  GuestPrompt,
  HomeRedirect,
} from '@/components';
import { ROUTES } from '@/constants';

const Active = lazy(() => import('./pages/session/Active'));
const Analysis = lazy(() => import('./pages/session/Analysis'));
const EditSession = lazy(() => import('./pages/session/EditSession'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
const Sessions = lazy(() => import('./pages/session/Sessions'));
const Compare = lazy(() => import('./pages/session/Compare'));
const Charts = lazy(() => import('./pages/session/Charts'));
const SharedSession = lazy(() => import('./pages/session/SharedSession'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Loading component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-blue"></div>
  </div>
);

const App = () => (
  <TooltipProvider>
    <ThemeProvider>
      <ErrorBoundary>
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

                      {/* Public Shared Session Route */}
                      <Route
                        path={ROUTES.SHARED_SESSION}
                        element={<SharedSession />}
                      />

                      {/* Protected Routes */}
                      <Route
                        path={ROUTES.HOME}
                        element={
                          <ProtectedRoute>
                            <HomeRedirect />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path={ROUTES.ACTIVE}
                        element={
                          <ProtectedRoute>
                            <Active />
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
                        path={ROUTES.EDIT_SESSION}
                        element={
                          <ProtectedRoute>
                            <EditSession />
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
              <GuestPrompt />
              <Sonner />
            </BrowserRouter>
          </SessionProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </TooltipProvider>
);

export default App;
