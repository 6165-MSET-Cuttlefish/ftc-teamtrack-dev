import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts';
import { useEscapeKey, useIsCompact } from '@/hooks';
import { APP_CONFIG, MOBILE_READY_ROUTES } from '@/constants';
import { DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Monitor } from 'lucide-react';

/**
 * Notice shown on phone-width screens for pages that do not have a compact
 * layout yet.
 *
 * Routes are opted in through `MOBILE_READY_ROUTES` rather than opted out, so
 * a new page never silently claims mobile support it does not have. Remove a
 * route from that list only by giving it a compact layout first.
 */
export const MobileWarning = () => {
  const { isDarkMode } = useTheme();
  const isCompact = useIsCompact();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const routeIsReady = MOBILE_READY_ROUTES.some(
    route => pathname === route || pathname.startsWith(`${route}/`)
  );

  const visible = !dismissed && !routeIsReady && isCompact;
  useEscapeKey(visible, () => setDismissed(true));

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <DialogContent
        className={`${isDarkMode ? 'bg-[#1a1a2e] border border-team-blue-20 text-white' : 'bg-white text-gray-900'}`}
      >
        <div className="flex flex-col items-center text-center px-6 py-8 gap-5">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isDarkMode ? 'bg-team-blue/10' : 'bg-team-blue/5'
            }`}
          >
            <Monitor className="h-8 w-8 text-team-blue" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold">Best on a bigger screen</h2>
            <p
              className={`text-sm leading-relaxed ${isDarkMode ? 'text-team-white-60' : 'text-gray-600'}`}
            >
              This page of {APP_CONFIG.name} isn&apos;t laid out for phones yet.
              Running a session works on mobile — for everything else, please
              use a computer.
            </p>
          </div>

          <Button
            onClick={() => setDismissed(true)}
            className={`w-full bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </div>
  );
};
