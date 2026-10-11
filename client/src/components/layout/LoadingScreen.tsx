/**
 * The one loading screen under the header: while a page downloads and while
 * sign-in settles (App's Suspense fallback and AuthReady, ProtectedRoute,
 * HomeRedirect).
 *
 * It has the page colour of every theme (bg-background). Without it,
 * Honeycomb's hexagons and Deep Sea's gradient (painted behind #root)
 * showed only while loading, then the page's flat surface snapped over
 * them. It fills <main> (a flex column) with flex-1, not with a second
 * min-h-screen that scrolled by exactly the header's height.
 */
export const LoadingScreen = () => (
  <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-background">
    <div className="animate-spin rounded-full h-10 w-10 border-2 border-team-blue/20 border-t-team-blue"></div>
    <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
  </div>
);
