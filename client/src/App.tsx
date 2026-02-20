import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, ThemeProvider, SessionProvider, TeamProvider } from '@/contexts';
import {
  ErrorBoundary,
  Header,
  ProtectedRoute,
  GuestPrompt,
  HomeRedirect,
  DeepSeaBubbles,
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
const JoinTeam = lazy(() => import('./pages/JoinTeam'));

// Loading component
const LoadingFallback = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4">
    <div className="relative">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-team-blue/20 border-t-team-blue"></div>
    </div>
    <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
  </div>
);

const App = () => (
  <TooltipProvider>
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <TeamProvider>
            <SessionProvider>
            <BrowserRouter>
              <div className="min-h-screen flex flex-col">
                <DeepSeaBubbles />
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
                      <Route
                        path={ROUTES.TEAM_INVITE}
                        element={
                          <ProtectedRoute>
                            <JoinTeam />
                          </ProtectedRoute>
                        }
                      />

                      {/* Public Shared Session Route */}
                      <Route
                        path={ROUTES.SHARED_SESSION}
                        element={<SharedSession />}
                      />

                      {/* Protected Routes */}
                      <Route
                        path={ROUTES.HOME}
                        element={<HomeRedirect />}
                      />
                      <Route
                        path={ROUTES.ACTIVE}
                        element={<Active />}
                      />
                      <Route
                        path={ROUTES.ANALYSIS}
                        element={<Analysis />}
                      />
                      <Route
                        path={ROUTES.EDIT_SESSION}
                        element={<EditSession />}
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
                        element={<Sessions />}
                      />
                      <Route
                        path={ROUTES.COMPARE}
                        element={<Compare />}
                      />
                      <Route
                        path={ROUTES.CHARTS}
                        element={<Charts />}
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
          </TeamProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </TooltipProvider>
);

export default App;
