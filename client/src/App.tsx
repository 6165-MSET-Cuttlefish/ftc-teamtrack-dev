import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import {
  BrowserRouter,
  NavigationType,
  Routes,
  Route,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { logEvent } from 'firebase/analytics';
import { getFirebase } from '@/lib';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
// Loaded with the app, on every route: finishes any session delete that a
// closed tab left inside its undo window.
import '@/lib/pendingSessionDeletes';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  AuthProvider,
  ThemeProvider,
  SessionProvider,
  TeamProvider,
  useAuth,
} from '@/contexts';
// The shell's parts come from their own folders, not the '@/components'
// barrel: through it the first download also carried every scoring-page
// module (and DOMPurify), which only /active and the review pages use.
import {
  DeepSeaBubbles,
  ErrorBoundary,
  Header,
  LoadingScreen,
} from '@/components/layout';
import { GuestPrompt, HomeRedirect, ProtectedRoute } from '@/components/auth';
import { ROUTES } from '@/constants';

const Active = lazyWithRetry(() => import('./pages/session/Active'));
const Analysis = lazyWithRetry(() => import('./pages/session/Analysis'));
const Login = lazyWithRetry(() => import('./pages/auth/Login'));
const Signup = lazyWithRetry(() => import('./pages/auth/Signup'));
const ForgotPassword = lazyWithRetry(() => import('./pages/auth/ForgotPassword'));
const Profile = lazyWithRetry(() => import('./pages/account/Profile'));
const Sessions = lazyWithRetry(() => import('./pages/session/Sessions'));
const Compare = lazyWithRetry(() => import('./pages/session/Compare'));
const Charts = lazyWithRetry(() => import('./pages/session/Charts'));
const SharedSession = lazyWithRetry(() => import('./pages/session/SharedSession'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const JoinTeam = lazyWithRetry(() => import('./pages/team/JoinTeam'));

/**
 * One Analytics page_view per page visited. A page rewriting its own
 * address in place (Sessions keeps its filters, sort and search in the
 * query string with replace navigations) is the same visit, so it doesn't
 * count again. A push, Back/Forward, the first load and a redirect to
 * another page still do.
 */
const RouteTracker = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const lastPathname = useRef<string | null>(null);
  useEffect(() => {
    const samePage =
      navigationType === NavigationType.Replace &&
      lastPathname.current === location.pathname;
    lastPathname.current = location.pathname;
    if (samePage) return;
    getFirebase().then(firebase => {
      if (firebase?.analytics) {
        logEvent(firebase.analytics, 'page_view', {
          page_path: location.pathname + location.search,
          page_location: window.location.href,
        });
      }
    });
  }, [location, navigationType]);
  return null;
};

/**
 * Catches a page that fails to render or to download without taking the
 * header and the session providers down with it. Moving to another page
 * clears the error.
 */
const RouteErrorBoundary = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary inline resetKey={pathname}>
      {children}
    </ErrorBoundary>
  );
};

/**
 * Holds a page until sign-in has settled, on the same loading screen as a
 * page download (Suspense below), so a cold load is one loading screen in
 * the page's own colour from the first frame. ProtectedRoute and
 * HomeRedirect show that screen too while they wait, for any use outside
 * this wrapper.
 */
const AuthReady = ({ children }: { children: ReactNode }) => {
  const { loading } = useAuth();
  return loading ? <LoadingScreen /> : <>{children}</>;
};

/** A page for a signed-in user or a guest, once sign-in has settled */
const Protected = ({ children }: { children: ReactNode }) => (
  <AuthReady>
    <ProtectedRoute>{children}</ProtectedRoute>
  </AuthReady>
);

const App = () => (
  <TooltipProvider>
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <TeamProvider>
            <SessionProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <RouteTracker />
              <div className="min-h-screen flex flex-col">
                <DeepSeaBubbles />
                <Header />
                {/* A flex column, so a page that fills the screen does it
                    with flex-1 under the header rather than a second
                    100dvh that scrolls by exactly the header's height. */}
                <main className="flex-1 flex flex-col">
                  <RouteErrorBoundary>
                  <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                      <Route path={ROUTES.LOGIN} element={<Login />} />
                      <Route path={ROUTES.SIGNUP} element={<Signup />} />
                      <Route
                        path={ROUTES.FORGOT_PASSWORD}
                        element={<ForgotPassword />}
                      />
                      <Route
                        path={ROUTES.TEAM_INVITE}
                        element={
                          <Protected>
                            <JoinTeam />
                          </Protected>
                        }
                      />

                      <Route
                        path={ROUTES.SHARED_SESSION}
                        element={<SharedSession />}
                      />

                      <Route
                        path={ROUTES.HOME}
                        element={
                          <AuthReady>
                            <HomeRedirect />
                          </AuthReady>
                        }
                      />
                      <Route
                        path={ROUTES.ACTIVE}
                        element={
                          <Protected>
                            <Active />
                          </Protected>
                        }
                      />
                      <Route
                        path={ROUTES.ANALYSIS}
                        element={
                          <Protected>
                            <Analysis />
                          </Protected>
                        }
                      />
                      <Route
                        path={ROUTES.PROFILE}
                        element={
                          <Protected>
                            <Profile />
                          </Protected>
                        }
                      />
                      <Route
                        path={ROUTES.SESSIONS}
                        element={
                          <Protected>
                            <Sessions />
                          </Protected>
                        }
                      />
                      <Route
                        path={ROUTES.COMPARE}
                        element={
                          <Protected>
                            <Compare />
                          </Protected>
                        }
                      />
                      <Route
                        path={ROUTES.CHARTS}
                        element={
                          <Protected>
                            <Charts />
                          </Protected>
                        }
                      />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                  </RouteErrorBoundary>
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
